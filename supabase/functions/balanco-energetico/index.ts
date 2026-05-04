/**
 * Fiskix Balanço Energético — Edge Function
 * Deno / Supabase Edge Functions
 *
 * Computes injected vs invoiced energy per substation for a given month
 * (or month range), classifying losses as technical or commercial.
 *
 * GET  /balanco-energetico?mes=YYYY-MM&meses=12&zona=xxx&tarifa=xxx
 * POST /balanco-energetico  body: { mes_ano: string, meses?: number, zona?, tipo_tarifa? }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DEFAULT_TECH_LOSS_PCT = 8;
const DEFAULT_PRICE_CVE_PER_KWH = 15;

interface InjecaoRow {
  id_subestacao: string;
  mes_ano: string;
  total_kwh_injetado: number;
  subestacoes?: { nome: string; ilha: string; zona_bairro: string } | null;
}

interface FaturacaoRow {
  mes_ano: string;
  kwh_faturado: number;
  clientes?: { id_subestacao: string; tipo_tarifa: string } | null;
}

function shiftMesAno(mesAno: string, deltaMeses: number): string {
  const [y, m] = mesAno.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMesesRange(anchor: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMesAno(anchor, -i));
  return out;
}

function classify(perdaPct: number) {
  if (perdaPct >= 25) return "critico";
  if (perdaPct >= 15) return "atencao";
  return "ok";
}

function computeBalanco(
  injecoes: InjecaoRow[],
  faturacoes: FaturacaoRow[],
  opts: { tipoTarifa?: string; zona?: string; tecnicoMaxPct: number; precoCvePorKwh: number },
) {
  const inj: Record<string, { kwh: number; nome: string; ilha: string; zona: string }> = {};
  for (const r of injecoes) {
    if (!inj[r.id_subestacao]) {
      inj[r.id_subestacao] = {
        kwh: 0,
        nome: r.subestacoes?.nome ?? "Desconhecida",
        ilha: r.subestacoes?.ilha ?? "—",
        zona: r.subestacoes?.zona_bairro ?? "—",
      };
    }
    inj[r.id_subestacao].kwh += r.total_kwh_injetado;
  }

  const fat: Record<string, number> = {};
  for (const r of faturacoes) {
    if (opts.tipoTarifa && r.clientes?.tipo_tarifa !== opts.tipoTarifa) continue;
    const subId = r.clientes?.id_subestacao ?? "";
    if (!subId) continue;
    fat[subId] = (fat[subId] ?? 0) + r.kwh_faturado;
  }

  const rows = Object.entries(inj).map(([id, info]) => {
    const inje = info.kwh;
    const fatu = fat[id] ?? 0;
    const perdaKwh = Math.max(0, inje - fatu);
    const perdaPct = inje > 0 ? (perdaKwh / inje) * 100 : 0;
    const tecCap = inje * (opts.tecnicoMaxPct / 100);
    const tecnica = Math.min(perdaKwh, tecCap);
    const comercial = Math.max(0, perdaKwh - tecnica);
    return {
      id,
      nome: info.nome,
      ilha: info.ilha,
      zona_bairro: info.zona,
      kwh_injetado: Math.round(inje),
      kwh_faturado: Math.round(fatu),
      perda_kwh: Math.round(perdaKwh),
      perda_pct: Math.round(perdaPct * 10) / 10,
      cve_estimado: Math.round(perdaKwh * opts.precoCvePorKwh),
      perda_tecnica_kwh: Math.round(tecnica),
      perda_comercial_kwh: Math.round(comercial),
      classificacao: classify(perdaPct),
    };
  });

  const filtered = opts.zona ? rows.filter((r) => r.zona_bairro === opts.zona) : rows;
  return filtered.sort((a, b) => b.perda_kwh - a.perda_kwh);
}

const ALLOWED_ROLES = new Set([
  "admin_fiskix",
  "diretor",
  "gestor_perdas",
  "supervisor",
]);
const ZONA_RESTRICTED_ROLES = new Set(["supervisor"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    // Authn/Authz first — the function uses the service role key below to
    // bypass RLS, so any caller without an explicit role check would be able
    // to read cross-zone aggregates. Mirror the pattern used in send-sms.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabaseAuth
      .from("perfis")
      .select("role, id_zona")
      .eq("id", userData.user.id)
      .single();
    if (!profile || !ALLOWED_ROLES.has(profile.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para consultar balanço" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let mesAno: string | undefined;
    let nMeses = 12;
    let zona: string | undefined;
    let tipoTarifa: string | undefined;

    if (req.method === "GET") {
      const url = new URL(req.url);
      mesAno = url.searchParams.get("mes") ?? undefined;
      nMeses = parseInt(url.searchParams.get("meses") ?? "12", 10) || 12;
      zona = url.searchParams.get("zona") ?? undefined;
      tipoTarifa = url.searchParams.get("tarifa") ?? undefined;
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      mesAno = body.mes_ano;
      nMeses = body.meses ?? 12;
      zona = body.zona;
      tipoTarifa = body.tipo_tarifa;
    } else {
      return new Response(JSON.stringify({ error: "Método não suportado" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Zone-restricted roles (supervisor) cannot query other zones.
    // Force their own id_zona regardless of the input parameter.
    if (ZONA_RESTRICTED_ROLES.has(profile.role)) {
      if (!profile.id_zona) {
        return new Response(JSON.stringify({ error: "Perfil sem zona atribuída" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      zona = profile.id_zona;
    }

    if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
      return new Response(JSON.stringify({ error: "mes_ano (YYYY-MM) é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carregar config
    const { data: configRows } = await supabase
      .from("configuracoes")
      .select("chave, valor");
    const config: Record<string, number> = {};
    for (const row of configRows ?? []) config[row.chave] = parseFloat(row.valor);

    const tecnicoMaxPct = config.limiar_perda_tecnica_pct ?? DEFAULT_TECH_LOSS_PCT;
    const precoCvePorKwh = config.preco_cve_por_kwh ?? DEFAULT_PRICE_CVE_PER_KWH;

    const meses = buildMesesRange(mesAno, nMeses);
    const yoyMes = shiftMesAno(mesAno, -12);
    const allMeses = Array.from(new Set([...meses, yoyMes]));

    const [injecaoRes, faturacaoRes] = await Promise.all([
      supabase
        .from("injecao_energia")
        .select("id_subestacao, mes_ano, total_kwh_injetado, subestacoes!inner(nome, ilha, zona_bairro)")
        .in("mes_ano", allMeses),
      supabase
        .from("faturacao_clientes")
        .select("mes_ano, kwh_faturado, clientes!inner(id_subestacao, tipo_tarifa)")
        .in("mes_ano", allMeses),
    ]);

    const injecoes = (injecaoRes.data ?? []) as InjecaoRow[];
    const faturacoes = (faturacaoRes.data ?? []) as FaturacaoRow[];

    const porSubestacao = computeBalanco(
      injecoes.filter((r) => r.mes_ano === mesAno),
      faturacoes.filter((r) => r.mes_ano === mesAno),
      { tipoTarifa, zona, tecnicoMaxPct, precoCvePorKwh },
    );

    const totalInjetado = porSubestacao.reduce((s, r) => s + r.kwh_injetado, 0);
    const totalFaturado = porSubestacao.reduce((s, r) => s + r.kwh_faturado, 0);
    const perdaKwh = Math.max(0, totalInjetado - totalFaturado);
    const perdaPct = totalInjetado > 0 ? (perdaKwh / totalInjetado) * 100 : 0;
    const perdaTecnicaKwh = porSubestacao.reduce((s, r) => s + r.perda_tecnica_kwh, 0);
    const perdaComercialKwh = porSubestacao.reduce((s, r) => s + r.perda_comercial_kwh, 0);

    // Evolução
    const evolucao = meses.map((m) => {
      const injMes = injecoes.filter((r) => r.mes_ano === m && (!zona || r.subestacoes?.zona_bairro === zona));
      const fatMes = faturacoes.filter((r) => r.mes_ano === m && (!tipoTarifa || r.clientes?.tipo_tarifa === tipoTarifa));
      const inj = injMes.reduce((s, r) => s + r.total_kwh_injetado, 0);
      const fat = fatMes.reduce((s, r) => s + r.kwh_faturado, 0);
      const perda = Math.max(0, inj - fat);
      return {
        mes_ano: m,
        kwh_injetado: Math.round(inj),
        kwh_faturado: Math.round(fat),
        perda_kwh: Math.round(perda),
        perda_pct: inj > 0 ? Math.round((perda / inj) * 10000) / 100 : 0,
      };
    });

    // YoY
    const porSubYoY = computeBalanco(
      injecoes.filter((r) => r.mes_ano === yoyMes),
      faturacoes.filter((r) => r.mes_ano === yoyMes),
      { tipoTarifa, zona, tecnicoMaxPct, precoCvePorKwh },
    );
    const totalInjYoY = porSubYoY.reduce((s, r) => s + r.kwh_injetado, 0);
    const totalFatYoY = porSubYoY.reduce((s, r) => s + r.kwh_faturado, 0);
    const perdaPctYoY = totalInjYoY > 0 ? ((totalInjYoY - totalFatYoY) / totalInjYoY) * 100 : 0;

    return new Response(
      JSON.stringify({
        mes_ano: mesAno,
        filtros: { zona: zona ?? null, tipo_tarifa: tipoTarifa ?? null, n_meses: nMeses },
        kpis: {
          total_injetado_kwh: totalInjetado,
          total_faturado_kwh: totalFaturado,
          perda_kwh: perdaKwh,
          perda_pct: Math.round(perdaPct * 10) / 10,
          perda_tecnica_kwh: perdaTecnicaKwh,
          perda_comercial_kwh: perdaComercialKwh,
          cve_estimado: Math.round(perdaKwh * precoCvePorKwh),
          subestacoes_criticas: porSubestacao.filter((r) => r.classificacao === "critico").length,
        },
        yoy: {
          mes_ano: yoyMes,
          perda_pct: Math.round(perdaPctYoY * 10) / 10,
          delta_pp: Math.round((perdaPct - perdaPctYoY) * 10) / 10,
        },
        por_subestacao: porSubestacao,
        evolucao,
        meta: {
          tecnico_max_pct: tecnicoMaxPct,
          preco_cve_por_kwh: precoCvePorKwh,
          duracao_ms: Date.now() - start,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro ao calcular balanço",
        detalhe: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
