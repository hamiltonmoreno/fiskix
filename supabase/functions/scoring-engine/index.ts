/**
 * Fiskix Scoring Engine — Edge Function
 * Deno / Supabase Edge Functions
 *
 * POST /scoring-engine
 * Body: { subestacao_id: string, mes_ano: string }
 *
 * A lógica das regras vive em ./pure.ts (testada em paridade com engine.ts).
 * Este ficheiro é apenas o adaptador Deno: auth, leituras Supabase, persistência.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  LIMIAR_QUEDA_PCT,
  LIMIAR_CV_MAXIMO,
  LIMIAR_MU_MINIMO,
  LIMIAR_ZSCORE_CLUSTER,
  LIMIAR_DIV_SAZONAL,
  LIMIAR_SLOPE_TENDENCIA,
  LIMIAR_RATIO_RACIO,
  LIMIAR_PICO_RATIO,
  LIMIAR_PERDA_ZONA_PCT,
  R6_MIN_CLUSTER_SIZE,
  R7_LOOKBACK_MESES,
  R9_MULT_BASE,
  R9_MULT_MAX_DELTA,
  R9_MULT_FACTOR,
  RESULTADOS_REINCIDENCIA,
  SCORE_LIMIAR_ALERTA,
} from "../_shared/scoring-constants.ts";
import { calcularScoreEdge } from "./pure.ts";

type UserRole = "admin_fiskix" | "diretor" | "gestor_perdas" | "supervisor" | "fiscal";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SCORING_ALLOWED_ROLES: UserRole[] = [
  "admin_fiskix",
  "diretor",
  "gestor_perdas",
  "supervisor",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Configuração de ambiente incompleta" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const isServiceRequest = authHeader === `Bearer ${serviceRoleKey}`;

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    if (!isServiceRequest) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser();
      if (authError || !user) {
        return jsonResponse({ error: "Token inválido" }, 401);
      }

      const { data: perfil } = await supabase
        .from("perfis")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!perfil?.role || !SCORING_ALLOWED_ROLES.includes(perfil.role as UserRole)) {
        return jsonResponse({ error: "Sem permissão para executar scoring" }, 403);
      }
    }

    const { subestacao_id, mes_ano } = await req.json();

    if (!subestacao_id || !mes_ano) {
      return jsonResponse({ error: "subestacao_id e mes_ano são obrigatórios" }, 400);
    }

    // 1. Carregar limiares configuráveis
    const { data: configRows } = await supabase
      .from("configuracoes")
      .select("chave, valor");

    const config: Record<string, number> = {};
    for (const row of (configRows ?? [])) {
      config[row.chave] = parseFloat(row.valor);
    }

    const limiares = {
      limiar_queda_pct: config.limiar_queda_pct ?? LIMIAR_QUEDA_PCT,
      limiar_cv_maximo: config.limiar_cv_maximo ?? LIMIAR_CV_MAXIMO,
      limiar_mu_minimo: config.limiar_mu_minimo ?? LIMIAR_MU_MINIMO,
      limiar_zscore_cluster: config.limiar_zscore_cluster ?? LIMIAR_ZSCORE_CLUSTER,
      limiar_div_sazonal: config.limiar_div_sazonal ?? LIMIAR_DIV_SAZONAL,
      limiar_slope_tendencia: config.limiar_slope_tendencia ?? LIMIAR_SLOPE_TENDENCIA,
      limiar_ratio_racio: config.limiar_ratio_racio ?? LIMIAR_RATIO_RACIO,
      limiar_pico_ratio: config.limiar_pico_ratio ?? LIMIAR_PICO_RATIO,
      limiar_perda_zona_pct: config.limiar_perda_zona_pct ?? LIMIAR_PERDA_ZONA_PCT,
    };

    // 2. ETAPA A: Balanço Energético
    const { data: injecao } = await supabase
      .from("injecao_energia")
      .select("total_kwh_injetado")
      .eq("id_subestacao", subestacao_id)
      .eq("mes_ano", mes_ano)
      .single();

    if (!injecao) {
      return jsonResponse({ error: `Sem dados de injeção para ${subestacao_id} em ${mes_ano}` }, 404);
    }

    // Clientes da subestação
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, numero_contador, nome_titular, tipo_tarifa, id_subestacao")
      .eq("id_subestacao", subestacao_id)
      .eq("ativo", true);

    if (!clientes || clientes.length === 0) {
      return jsonResponse({ message: "Sem clientes ativos nesta subestação", scored: 0 });
    }

    const clienteIds = clientes.map((c) => c.id);

    // Faturação do mês atual para calcular total faturado
    const { data: faturacaoMes } = await supabase
      .from("faturacao_clientes")
      .select("id_cliente, kwh_faturado, valor_cve")
      .eq("mes_ano", mes_ano)
      .in("id_cliente", clienteIds);

    const totalFaturado = (faturacaoMes ?? []).reduce(
      (s, f) => s + f.kwh_faturado,
      0
    );

    const kwh_injetado = injecao.total_kwh_injetado;
    const perda_pct = kwh_injetado > 0
      ? ((kwh_injetado - totalFaturado) / kwh_injetado) * 100
      : 0;
    const zona_vermelha = perda_pct > limiares.limiar_perda_zona_pct;
    const multiplicador_zona = zona_vermelha
      ? R9_MULT_BASE +
        Math.min(
          R9_MULT_MAX_DELTA,
          (perda_pct / 100 - limiares.limiar_perda_zona_pct / 100) * R9_MULT_FACTOR
        )
      : R9_MULT_BASE;

    // Se zona não é vermelha, não pontuar clientes individuais
    if (!zona_vermelha) {
      return jsonResponse({
        subestacao_id,
        mes_ano,
        perda_pct: perda_pct.toFixed(2),
        zona_vermelha: false,
        multiplicador_zona: R9_MULT_BASE,
        message: "Zona verde — sem scoring individual necessário",
        duracao_ms: Date.now() - start,
      });
    }

    // 3. ETAPA B: Histórico de faturação (36 meses) para scoring
    const { data: faturacaoHistorico } = await supabase
      .from("faturacao_clientes")
      .select("id_cliente, mes_ano, kwh_faturado, valor_cve")
      .in("id_cliente", clienteIds)
      .order("mes_ano", { ascending: true });

    // Alertas anteriores por cliente (não falso-positivos, últimos R7_LOOKBACK_MESES meses)
    // month é 1-indexed; Date espera 0-indexed; já é considerado pelo offset
    // R7_LOOKBACK_MESES (definido em scoring/constants.ts).
    const [year, month] = mes_ano.split("-").map(Number);
    const mes12Atras = new Date(year, month - R7_LOOKBACK_MESES, 1);
    const mes12AtrasFmt = `${mes12Atras.getFullYear()}-${String(mes12Atras.getMonth() + 1).padStart(2, "0")}`;

    const { data: alertasHist } = await supabase
      .from("alertas_fraude")
      .select("id_cliente, resultado")
      .in("id_cliente", clienteIds)
      .gte("mes_ano", mes12AtrasFmt)
      .lt("mes_ano", mes_ano)
      .in("resultado", RESULTADOS_REINCIDENCIA);

    const alertasPorCliente: Record<string, number> = {};
    for (const a of (alertasHist ?? [])) {
      alertasPorCliente[a.id_cliente] = (alertasPorCliente[a.id_cliente] ?? 0) + 1;
    }

    // 4. Calcular info de cluster por tipo de tarifa
    const faturacaoMesMap: Record<string, { kwh: number; cve: number }> = {};
    for (const f of (faturacaoMes ?? [])) {
      faturacaoMesMap[f.id_cliente] = { kwh: f.kwh_faturado, cve: f.valor_cve };
    }

    const clusterPorTarifa: Record<string, number[]> = {};
    for (const c of clientes) {
      const f = faturacaoMesMap[c.id];
      if (f) {
        if (!clusterPorTarifa[c.tipo_tarifa]) clusterPorTarifa[c.tipo_tarifa] = [];
        clusterPorTarifa[c.tipo_tarifa].push(f.kwh);
      }
    }

    function calcMediana(arr: number[]): number {
      if (arr.length === 0) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    function calcMAD(arr: number[], med: number): number {
      return calcMediana(arr.map((v) => Math.abs(v - med)));
    }

    // Tendência subestação (variação mês a mês)
    const mesAnterior = (() => {
      const [y, m] = mes_ano.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const { data: injecaoAnt } = await supabase
      .from("injecao_energia")
      .select("total_kwh_injetado")
      .eq("id_subestacao", subestacao_id)
      .eq("mes_ano", mesAnterior)
      .single();

    const tendenciaSubestacao = injecaoAnt?.total_kwh_injetado
      ? ((kwh_injetado - injecaoAnt.total_kwh_injetado) / injecaoAnt.total_kwh_injetado) * 100
      : 0;

    // 5. Pontuar cada cliente — delega na lógica pura de pure.ts
    const alertasParaInserir = [];

    for (const cliente of clientes) {
      const fHist = (faturacaoHistorico ?? [])
        .filter((f) => f.id_cliente === cliente.id)
        .map((f) => ({ mes_ano: f.mes_ano, kwh_faturado: f.kwh_faturado, valor_cve: f.valor_cve }));

      const fAtual = faturacaoMesMap[cliente.id];
      if (!fAtual || fHist.length < 3) continue;

      // Cluster info para este cliente
      const grupoTarifa = clusterPorTarifa[cliente.tipo_tarifa] ?? [];
      const med = calcMediana(grupoTarifa);
      const madVal = calcMAD(grupoTarifa, med);

      // Rácio CVE/kWh do cluster
      const raciosPorTarifa = clientes
        .filter((c) => c.tipo_tarifa === cliente.tipo_tarifa)
        .map((c) => {
          const fm = faturacaoMesMap[c.id];
          return fm && fm.kwh > 0 ? fm.cve / fm.kwh : null;
        })
        .filter((r): r is number => r !== null);

      const mediaRacio = raciosPorTarifa.length
        ? raciosPorTarifa.reduce((s, r) => s + r, 0) / raciosPorTarifa.length
        : 0;
      // R6 needs at least R6_MIN_CLUSTER_SIZE customers in the same tariff
      // group to compute a meaningful sigma; abaixo disso `sigma=0` faz a regra
      // ser ignorada (evita fallback `sigma=1` em clusters minúsculos).
      const sigmaRacio = raciosPorTarifa.length >= R6_MIN_CLUSTER_SIZE
        ? Math.sqrt(
          raciosPorTarifa.reduce((s, r) => s + Math.pow(r - mediaRacio, 2), 0) /
          raciosPorTarifa.length
        )
        : 0;

      const { regras, score_final } = calcularScoreEdge(
        {
          faturacao: fHist,
          mesAtual: mes_ano,
          kwhAtual: fAtual.kwh,
          cveAtual: fAtual.cve,
          medianaCluster: med,
          madCluster: madVal,
          mediaRacio,
          sigmaRacio,
          clusterSize: raciosPorTarifa.length,
          tendenciaSubestacao,
          alertasAnteriores: alertasPorCliente[cliente.id] ?? 0,
          multiplicadorZona: multiplicador_zona,
        },
        limiares
      );

      if (score_final >= SCORE_LIMIAR_ALERTA) {
        alertasParaInserir.push({
          id_cliente: cliente.id,
          score_risco: score_final,
          motivo: regras,
          status: "Pendente" as const,
          mes_ano,
        });
      }
    }

    // 6. Inserir novos alertas; actualizar score/motivo apenas em alertas ainda Pendente
    // Nunca sobrescrever status de alertas já em Notificado_SMS, Pendente_Inspecao ou Inspecionado
    let inseridos = 0;
    let actualizados = 0;
    if (alertasParaInserir.length > 0) {
      const clienteIds = alertasParaInserir.map((a) => a.id_cliente);

      // Verificar estado actual dos alertas existentes para este mês
      const { data: existentes } = await supabase
        .from("alertas_fraude")
        .select("id_cliente, status")
        .eq("mes_ano", mes_ano)
        .in("id_cliente", clienteIds);

      const existentesMap = new Map((existentes ?? []).map((e) => [e.id_cliente, e.status]));

      const novos = alertasParaInserir.filter((a) => !existentesMap.has(a.id_cliente));
      const actualizaveis = alertasParaInserir.filter((a) => existentesMap.get(a.id_cliente) === "Pendente");

      // INSERT novos alertas — pedir count exato para reportar bem ao admin
      if (novos.length > 0) {
        const { error, count } = await supabase
          .from("alertas_fraude")
          .insert(novos, { count: "exact" });
        if (!error) inseridos += count ?? novos.length;
        else console.error("Erro ao inserir novos alertas:", error);
      }

      // UPDATE score e motivo apenas em alertas ainda Pendente (não actuados)
      for (const a of actualizaveis) {
        const { error, count } = await supabase
          .from("alertas_fraude")
          .update({ score_risco: a.score_risco, motivo: a.motivo }, { count: "exact" })
          .eq("id_cliente", a.id_cliente)
          .eq("mes_ano", mes_ano)
          .eq("status", "Pendente");
        if (!error && (count ?? 0) > 0) actualizados++;
      }

    }

    const duracao_ms = Date.now() - start;

    return new Response(
      JSON.stringify({
        subestacao_id,
        mes_ano,
        kwh_injetado,
        kwh_faturado_total: totalFaturado,
        perda_pct: perda_pct.toFixed(2),
        zona_vermelha,
        multiplicador_zona: multiplicador_zona.toFixed(3),
        clientes_analisados: clientes.length,
        alertas_gerados: alertasParaInserir.length,
        alertas_inseridos: inseridos,
        alertas_actualizados: actualizados,
        duracao_ms,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no scoring engine:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
