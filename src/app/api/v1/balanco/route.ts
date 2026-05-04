import { createClient } from "@supabase/supabase-js";
import { verificarApiKey } from "@/lib/api/auth";
import { apiError, apiCors } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rateLimit";

/**
 * GET /api/v1/balanco
 *
 * Parâmetros opcionais:
 *   mes_ano       YYYY-MM (obrigatório)
 *   subestacao_id UUID (opcional — omitir para todas)
 *
 * Headers: Authorization: Bearer <api_key>
 */
export async function OPTIONS() {
  return apiCors();
}

export async function GET(request: Request) {
  const cliente = await verificarApiKey(request);
  if (!cliente) return apiError("API key inválida ou ausente", 401);

  const { allowed, remaining } = await checkRateLimit(cliente);
  if (!allowed) return apiError("Rate limit excedido.", 429);

  const { searchParams } = new URL(request.url);
  const mes_ano = searchParams.get("mes_ano");
  const subestacao_id = searchParams.get("subestacao_id");

  if (!mes_ano || !/^\d{4}-\d{2}$/.test(mes_ano)) {
    return apiError("mes_ano é obrigatório no formato YYYY-MM", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Configurações
  const { data: config } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["limiar_perda_zona_pct", "perda_tecnica_estimada_pct"]);

  const cfg: Record<string, number> = {};
  for (const c of config ?? []) cfg[c.chave] = parseFloat(c.valor);
  const limiarZona = cfg.limiar_perda_zona_pct ?? 15;
  const perdaTecnicaPct = cfg.perda_tecnica_estimada_pct ?? 5;

  // Subestações
  let subQuery = supabase.from("subestacoes").select("id, nome, zona_bairro, ilha").eq("ativo", true);
  if (subestacao_id) subQuery = subQuery.eq("id", subestacao_id);
  const { data: subestacoes, error: subErr } = await subQuery;
  if (subErr || !subestacoes?.length) return apiError("Subestações não encontradas", 404);

  const subIds = subestacoes.map((s) => s.id);

  // Injeção e faturação em paralelo
  const [injecaoRes, faturacaoRes] = await Promise.all([
    supabase.from("injecao_energia").select("id_subestacao, total_kwh_injetado").eq("mes_ano", mes_ano).in("id_subestacao", subIds),
    supabase.from("faturacao_clientes").select("kwh_faturado, valor_cve, clientes!inner(id_subestacao)").eq("mes_ano", mes_ano),
  ]);

  const injMap: Record<string, number> = {};
  for (const r of injecaoRes.data ?? []) injMap[r.id_subestacao] = r.total_kwh_injetado;

  const fatMap: Record<string, number> = {};
  const cveMap: Record<string, number> = {};
  for (const r of (faturacaoRes.data ?? []) as unknown as Array<{ kwh_faturado: number; valor_cve: number; clientes: { id_subestacao: string } | null }>) {
    const sid = r.clientes?.id_subestacao ?? "";
    if (sid) {
      fatMap[sid] = (fatMap[sid] ?? 0) + r.kwh_faturado;
      cveMap[sid] = (cveMap[sid] ?? 0) + r.valor_cve;
    }
  }

  const resultados = subestacoes.map((sub) => {
    const kwh_injetado = injMap[sub.id] ?? 0;
    const kwh_faturado = fatMap[sub.id] ?? 0;
    const perda_kwh = Math.max(0, kwh_injetado - kwh_faturado);
    const perda_pct = kwh_injetado > 0 ? parseFloat(((perda_kwh / kwh_injetado) * 100).toFixed(2)) : 0;
    const perda_tecnica_kwh = Math.round(kwh_injetado * (perdaTecnicaPct / 100));
    const perda_comercial_kwh = Math.max(0, Math.round(perda_kwh - perda_tecnica_kwh));
    const tarifa_media = kwh_faturado > 0 ? (cveMap[sub.id] ?? 0) / kwh_faturado : 15;
    return {
      subestacao_id: sub.id,
      nome: sub.nome,
      zona_bairro: sub.zona_bairro,
      ilha: sub.ilha,
      mes_ano,
      kwh_injetado: Math.round(kwh_injetado),
      kwh_faturado: Math.round(kwh_faturado),
      perda_kwh: Math.round(perda_kwh),
      perda_pct,
      perda_tecnica_kwh,
      perda_comercial_kwh,
      zona_vermelha: perda_pct > limiarZona,
      cve_perdido_estimado: Math.round(perda_kwh * tarifa_media),
    };
  });

  const totais = {
    kwh_injetado: resultados.reduce((s, r) => s + r.kwh_injetado, 0),
    kwh_faturado: resultados.reduce((s, r) => s + r.kwh_faturado, 0),
    perda_kwh: resultados.reduce((s, r) => s + r.perda_kwh, 0),
    perda_tecnica_kwh: resultados.reduce((s, r) => s + r.perda_tecnica_kwh, 0),
    perda_comercial_kwh: resultados.reduce((s, r) => s + r.perda_comercial_kwh, 0),
    cve_perdido_estimado: resultados.reduce((s, r) => s + r.cve_perdido_estimado, 0),
    zonas_vermelhas: resultados.filter((r) => r.zona_vermelha).length,
  };

  return new Response(
    JSON.stringify({ data: { mes_ano, totais, subestacoes: resultados } }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(remaining),
      },
    }
  );
}
