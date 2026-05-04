/**
 * Fiskix — Edge Function: ml-scoring
 * Deno / Supabase Edge Functions
 *
 * Calcula score ML complementar para clientes com alertas ativos,
 * usando pesos heurísticos da tabela configuracoes (chave: ml_pesos_v1).
 *
 * POST /ml-scoring
 * Body: { mes_ano: string, subestacao_id?: string }
 *
 * Chamado pelo cron /api/cron/ml no dia 2 de cada mês às 03:00 UTC.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PesosML {
  queda_pct: number;
  cv: number;
  zscore: number;
  slope: number;
  ratio_pico: number;
  alertas_12m: number;
  perda_zona: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuração de ambiente incompleta" }, 500);
    }

    // Apenas service role pode chamar esta função
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { mes_ano, subestacao_id } = body as { mes_ano?: string; subestacao_id?: string };

    if (!mes_ano || !/^\d{4}-\d{2}$/.test(mes_ano)) {
      return jsonResponse({ error: "mes_ano é obrigatório no formato YYYY-MM" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Carregar pesos ML
    const { data: configRows } = await supabase
      .from("configuracoes")
      .select("chave, valor");

    const configMap: Record<string, string> = {};
    for (const c of configRows ?? []) configMap[c.chave] = c.valor;

    // Modelo ativo (auto-promovido pelo cron quando há ground truth suficiente).
    // Cada modelo tem o seu conjunto de pesos: ml_pesos_v1 / ml_pesos_v1_logistic.
    const modeloAtivo = (configMap.ml_modelo_ativo ?? "heuristic_v1") as "heuristic_v1" | "logistic_v1";
    const pesosKey = modeloAtivo === "logistic_v1" ? "ml_pesos_v1_logistic" : "ml_pesos_v1";

    let pesos: PesosML;
    try {
      pesos = configMap[pesosKey]
        ? JSON.parse(configMap[pesosKey])
        : { queda_pct: 0.35, cv: 0.20, zscore: 0.15, slope: 0.10, ratio_pico: 0.08, alertas_12m: 0.07, perda_zona: 0.05 };
    } catch {
      // Pesos inválidos → fallback para defaults heurísticos
      pesos = { queda_pct: 0.35, cv: 0.20, zscore: 0.15, slope: 0.10, ratio_pico: 0.08, alertas_12m: 0.07, perda_zona: 0.05 };
    }

    // Obter alertas ativos no mês (score >= 50 já calculado pelo scoring-engine)
    let alertasQuery = supabase
      .from("alertas_fraude")
      .select("id, id_cliente, score_risco, motivo, mes_ano")
      .eq("mes_ano", mes_ano)
      .gte("score_risco", 50);

    if (subestacao_id) {
      // Filtrar por subestação via join clientes
      const { data: clientesSub } = await supabase
        .from("clientes")
        .select("id")
        .eq("id_subestacao", subestacao_id)
        .eq("ativo", true);
      const ids = (clientesSub ?? []).map((c: { id: string }) => c.id);
      if (ids.length > 0) {
        alertasQuery = alertasQuery.in("id_cliente", ids);
      } else {
        return jsonResponse({ mes_ano, subestacao_id, scored: 0, duracao_ms: Date.now() - start });
      }
    }

    const { data: alertas, error: alertasErr } = await alertasQuery;
    if (alertasErr || !alertas?.length) {
      return jsonResponse({ mes_ano, scored: 0, duracao_ms: Date.now() - start });
    }

    const limiarPerda = parseFloat(configMap.limiar_perda_zona_pct ?? "15");

    let scored = 0;
    const predicoes = [];

    for (const alerta of alertas) {
      const motivo: Array<{ regra: string; pontos: number; valor?: number; threshold?: number }> = alerta.motivo ?? [];

      // Extrair features dos motivos calculados pelo scoring-engine
      const r1 = motivo.find((r) => r.regra === "R1");
      const r2 = motivo.find((r) => r.regra === "R2");
      const r3 = motivo.find((r) => r.regra === "R3");
      const r5 = motivo.find((r) => r.regra === "R5");
      const r7 = motivo.find((r) => r.regra === "R7");
      const r8 = motivo.find((r) => r.regra === "R8");

      // Normalizar features para [0, 1]
      const f_queda = r1 ? Math.min(1, (r1.valor ?? 0) / 100) : 0;
      const f_cv = r2 ? Math.min(1, 1 - (r2.valor ?? 1) / 0.1) : 0;
      const f_zscore = r3 ? Math.min(1, Math.max(0, Math.abs(r3.valor ?? 0) / 5)) : 0;
      const f_slope = r5 ? Math.min(1, Math.max(0, Math.abs(r5.valor ?? 0) / 20)) : 0;
      const f_ratio_pico = r8 ? Math.min(1, 1 - (r8.valor ?? 1)) : 0;
      const f_alertas_12m = r7 ? Math.min(1, (r7.valor ?? 0) / 5) : 0;
      const f_perda_zona = Math.min(1, alerta.score_risco / 100);

      // Regressão logística: combinação linear dos pesos
      const z =
        pesos.queda_pct * f_queda +
        pesos.cv * f_cv +
        pesos.zscore * f_zscore +
        pesos.slope * f_slope +
        pesos.ratio_pico * f_ratio_pico +
        pesos.alertas_12m * f_alertas_12m +
        pesos.perda_zona * f_perda_zona;

      // Sigmoid para [0, 1]
      const score_ml = parseFloat((1 / (1 + Math.exp(-6 * (z - 0.5)))).toFixed(4));

      const features_json = {
        f_queda, f_cv, f_zscore, f_slope, f_ratio_pico, f_alertas_12m, f_perda_zona,
        score_risco: alerta.score_risco,
      };

      predicoes.push({
        id_cliente: alerta.id_cliente,
        mes_ano,
        score_ml,
        modelo_versao: modeloAtivo,
        features_json,
      });
    }

    // UPSERT: inserir ou actualizar predições
    if (predicoes.length > 0) {
      const { error: upsertErr } = await supabase
        .from("ml_predicoes")
        .upsert(predicoes, { onConflict: "id_cliente,mes_ano,modelo_versao" });

      if (!upsertErr) scored = predicoes.length;
      else console.error("[ml-scoring] Erro no upsert:", upsertErr);
    }

    return jsonResponse({
      mes_ano,
      subestacao_id: subestacao_id ?? null,
      scored,
      duracao_ms: Date.now() - start,
    });
  } catch (err) {
    console.error("[ml-scoring]", err);
    return jsonResponse({ error: "Erro interno", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
