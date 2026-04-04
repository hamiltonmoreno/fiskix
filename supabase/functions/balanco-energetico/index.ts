/**
 * Fiskix — Edge Function: balanço-energetico
 * Deno / Supabase Edge Functions
 *
 * Calcula o balanço energético agregado por subestação (ou todas) para um mês,
 * retornando perdas %, kWh injetado, kWh faturado e valor estimado da perda em CVE.
 *
 * GET  /balanco-energetico?mes_ano=YYYY-MM
 * GET  /balanco-energetico?mes_ano=YYYY-MM&subestacao_id=UUID
 * POST /balanco-energetico  { mes_ano, subestacao_id? }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BalancoSubestacao {
  subestacao_id: string;
  nome: string;
  zona_bairro: string;
  mes_ano: string;
  kwh_injetado: number;
  kwh_faturado: number;
  perda_kwh: number;
  perda_pct: number;
  zona_vermelha: boolean;
  cve_perdido_estimado: number;
  num_clientes: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Suportar GET (query params) e POST (body)
    let mes_ano: string | null = null;
    let subestacao_id: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      mes_ano = url.searchParams.get("mes_ano");
      subestacao_id = url.searchParams.get("subestacao_id");
    } else {
      const body = await req.json().catch(() => ({}));
      mes_ano = body.mes_ano ?? null;
      subestacao_id = body.subestacao_id ?? null;
    }

    if (!mes_ano || !/^\d{4}-\d{2}$/.test(mes_ano)) {
      return new Response(
        JSON.stringify({ error: "mes_ano é obrigatório no formato YYYY-MM" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limiar de zona vermelha das configurações
    const { data: configRows } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .eq("chave", "limiar_perda_zona_pct")
      .single();

    const limiarPerda = configRows ? parseFloat(configRows.valor) : 15;

    // Obter subestações (uma ou todas)
    let subQuery = supabase
      .from("subestacoes")
      .select("id, nome, zona_bairro")
      .eq("ativo", true);

    if (subestacao_id) {
      subQuery = subQuery.eq("id", subestacao_id);
    }

    const { data: subestacoes, error: subError } = await subQuery;

    if (subError || !subestacoes?.length) {
      return new Response(
        JSON.stringify({ error: "Subestações não encontradas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: BalancoSubestacao[] = [];

    for (const sub of subestacoes) {
      // kWh injetado na subestação
      const { data: injecao } = await supabase
        .from("injecao_energia")
        .select("total_kwh_injetado")
        .eq("id_subestacao", sub.id)
        .eq("mes_ano", mes_ano)
        .single();

      const kwh_injetado = injecao?.total_kwh_injetado ?? 0;

      // kWh faturado + valor CVE agregado dos clientes da subestação
      const { data: faturacao } = await supabase
        .from("faturacao_clientes")
        .select("kwh_faturado, valor_cve, clientes!inner(id_subestacao)")
        .eq("mes_ano", mes_ano)
        .eq("clientes.id_subestacao", sub.id);

      const rows = (faturacao ?? []) as Array<{
        kwh_faturado: number;
        valor_cve: number;
      }>;

      const kwh_faturado = rows.reduce((s, r) => s + (r.kwh_faturado ?? 0), 0);
      const cve_faturado = rows.reduce((s, r) => s + (r.valor_cve ?? 0), 0);
      const num_clientes = rows.length;

      const perda_kwh = Math.max(0, kwh_injetado - kwh_faturado);
      const perda_pct =
        kwh_injetado > 0 ? (perda_kwh / kwh_injetado) * 100 : 0;

      // Tarifa média como proxy do custo unitário das perdas
      const tarifa_media =
        kwh_faturado > 0 ? cve_faturado / kwh_faturado : 15;
      const cve_perdido_estimado = Math.round(perda_kwh * tarifa_media);

      resultados.push({
        subestacao_id: sub.id,
        nome: sub.nome,
        zona_bairro: sub.zona_bairro,
        mes_ano,
        kwh_injetado: Math.round(kwh_injetado),
        kwh_faturado: Math.round(kwh_faturado),
        perda_kwh: Math.round(perda_kwh),
        perda_pct: parseFloat(perda_pct.toFixed(2)),
        zona_vermelha: perda_pct > limiarPerda,
        cve_perdido_estimado,
        num_clientes,
      });
    }

    // Totais agregados
    const totais = {
      kwh_injetado: resultados.reduce((s, r) => s + r.kwh_injetado, 0),
      kwh_faturado: resultados.reduce((s, r) => s + r.kwh_faturado, 0),
      perda_kwh: resultados.reduce((s, r) => s + r.perda_kwh, 0),
      cve_perdido_estimado: resultados.reduce(
        (s, r) => s + r.cve_perdido_estimado,
        0
      ),
      zonas_vermelhas: resultados.filter((r) => r.zona_vermelha).length,
      total_subestacoes: resultados.length,
    };

    totais.perda_pct =
      totais.kwh_injetado > 0
        ? parseFloat(
            ((totais.perda_kwh / totais.kwh_injetado) * 100).toFixed(2)
          )
        : 0;

    return new Response(
      JSON.stringify({ mes_ano, totais, subestacoes: resultados }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[balanco-energetico]", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        detail: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
