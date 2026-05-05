"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/observability/logger";
import {
  agregarKPIs,
  buildMesesRange,
  calcularBalancoPorSubestacao,
  calcularEvolucaoMensal,
  shiftMesAno,
  topContribuidores,
  DEFAULT_ATENCAO_PCT,
  DEFAULT_CRITICO_PCT,
  DEFAULT_PRICE_CVE_PER_KWH,
  DEFAULT_TECH_LOSS_PCT,
  type BalancoKPIs,
  type BalancoOptions,
  type ClienteContribuidor,
  type EvolucaoMensalRow,
  type FaturacaoRow,
  type InjecaoRow,
  type SubestacaoBalancoRow,
} from "../lib/balanco";

export interface BalancoFiltros {
  mesAno: string; // YYYY-MM
  zona?: string;
  tipoTarifa?: string;
  /** Number of months for the trend chart (default: 12) */
  nMeses?: number;
}

export interface BalancoData {
  kpis: BalancoKPIs;
  porSubestacao: SubestacaoBalancoRow[];
  evolucao: EvolucaoMensalRow[];
  /** Same KPIs computed for the same calendar month one year before, for YoY. */
  yoy?: { perdaPct: number; perdaKwh: number; deltaPct: number };
}

export interface DrillDownData {
  evolucao: EvolucaoMensalRow[];
  contribuidores: ClienteContribuidor[];
}

export function useBalanco(filtros: BalancoFiltros) {
  const [data, setData] = useState<BalancoData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const nMeses = filtros.nMeses ?? 12;
    // Anchor the trend window at the *selected* month, not at "now". The
    // previous getLastNMonths(...).filter(<= mesAno) approach silently
    // truncated the window for historical selections.
    const meses = buildMesesRange(filtros.mesAno, nMeses);
    const yoyMes = shiftMesAno(filtros.mesAno, -12);
    const mesesPlusYoy = Array.from(new Set([...meses, yoyMes]));

    const [injecaoRes, faturacaoRes, configRes] = await Promise.all([
      supabase
        .from("injecao_energia")
        .select("id_subestacao, mes_ano, total_kwh_injetado, subestacoes!inner(nome, ilha, zona_bairro)")
        .in("mes_ano", mesesPlusYoy),
      supabase
        .from("faturacao_clientes")
        .select("mes_ano, kwh_faturado, valor_cve, clientes!inner(id, id_subestacao, tipo_tarifa)")
        .in("mes_ano", mesesPlusYoy),
      supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", [
          "limiar_perda_tecnica_pct",
          "preco_cve_por_kwh",
          "limiar_atencao_perda_pct",
          "limiar_critico_perda_pct",
        ]),
    ]);

    // Surface partial query failures via logger so they're not silently
    // swallowed. We continue with whatever data did load (config falls back
    // to defaults below) but the operator can debug from logs.
    const log = logger({ hook: "useBalanco" });
    if (injecaoRes.error) log.error("query_failed", { table: "injecao_energia", error: injecaoRes.error.message });
    if (faturacaoRes.error) log.error("query_failed", { table: "faturacao_clientes", error: faturacaoRes.error.message });
    if (configRes.error) log.error("query_failed", { table: "configuracoes", error: configRes.error.message });

    const cfg: Record<string, number> = {};
    for (const row of configRes.data ?? []) cfg[row.chave] = parseFloat(row.valor);
    const sharedOpts: BalancoOptions = {
      tecnicoMaxPct: cfg.limiar_perda_tecnica_pct ?? DEFAULT_TECH_LOSS_PCT,
      precoCvePorKwh: cfg.preco_cve_por_kwh ?? DEFAULT_PRICE_CVE_PER_KWH,
      atencaoPct: cfg.limiar_atencao_perda_pct ?? DEFAULT_ATENCAO_PCT,
      criticoPct: cfg.limiar_critico_perda_pct ?? DEFAULT_CRITICO_PCT,
      zona: filtros.zona,
      tipoTarifa: filtros.tipoTarifa,
    };

    const allInjecoes: InjecaoRow[] = (injecaoRes.data ?? []).map((r: Record<string, unknown>) => ({
      id_subestacao: r.id_subestacao as string,
      mes_ano: r.mes_ano as string,
      total_kwh_injetado: r.total_kwh_injetado as number,
      subestacao: r.subestacoes as { nome: string; ilha: string; zona_bairro: string } | null,
    }));

    const allFaturacoes: FaturacaoRow[] = (faturacaoRes.data ?? []).map((r: Record<string, unknown>) => ({
      mes_ano: r.mes_ano as string,
      kwh_faturado: r.kwh_faturado as number,
      valor_cve: r.valor_cve as number,
      cliente: r.clientes as { id: string; id_subestacao: string; tipo_tarifa: string } | null,
    }));

    // Current month rows for substation breakdown
    const injCurrent = allInjecoes.filter((r) => r.mes_ano === filtros.mesAno);
    const fatCurrent = allFaturacoes.filter((r) => r.mes_ano === filtros.mesAno);

    const porSubestacao = calcularBalancoPorSubestacao(injCurrent, fatCurrent, sharedOpts);

    const kpis = agregarKPIs(porSubestacao, sharedOpts);

    // Trend over last N months
    const evolucao = calcularEvolucaoMensal(
      allInjecoes.filter((r) => meses.includes(r.mes_ano)),
      allFaturacoes.filter((r) => meses.includes(r.mes_ano)),
      meses,
      sharedOpts,
    );

    // YoY comparison
    const injYoY = allInjecoes.filter((r) => r.mes_ano === yoyMes);
    const fatYoY = allFaturacoes.filter((r) => r.mes_ano === yoyMes);
    const porSubYoY = calcularBalancoPorSubestacao(injYoY, fatYoY, sharedOpts);
    const kpisYoY = agregarKPIs(porSubYoY, sharedOpts);
    const yoy = porSubYoY.length > 0
      ? {
          perdaPct: kpisYoY.perdaPct,
          perdaKwh: kpisYoY.perdaKwh,
          deltaPct: Math.round((kpis.perdaPct - kpisYoY.perdaPct) * 10) / 10,
        }
      : undefined;

    setData({ kpis, porSubestacao, evolucao, yoy });
    } finally {
      setLoading(false);
    }
  }, [filtros.mesAno, filtros.zona, filtros.tipoTarifa, filtros.nMeses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rely on the memoized `load` callback identity (which only changes when one
  // of the filter primitives changes) instead of the filtros object identity.
  // The previous JSON.stringify gate could mask a legitimate refetch when a
  // parent re-renders and passes a new filtros object with the same values.
  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}

export async function fetchDrillDown(
  idSubestacao: string,
  mesAno: string,
  nMeses = 6,
): Promise<DrillDownData> {
  const supabase = createClient();
  const meses = buildMesesRange(mesAno, nMeses);

  const [injecaoRes, faturacaoRes] = await Promise.all([
    supabase
      .from("injecao_energia")
      .select("id_subestacao, mes_ano, total_kwh_injetado")
      .eq("id_subestacao", idSubestacao)
      .in("mes_ano", meses),
    supabase
      .from("faturacao_clientes")
      .select("mes_ano, kwh_faturado, valor_cve, clientes!inner(id, id_subestacao, nome_titular, numero_contador)")
      .eq("clientes.id_subestacao", idSubestacao)
      .in("mes_ano", meses),
  ]);

  const injecoes: InjecaoRow[] = (injecaoRes.data ?? []).map((r) => ({
    id_subestacao: r.id_subestacao,
    mes_ano: r.mes_ano,
    total_kwh_injetado: r.total_kwh_injetado,
  }));

  const faturacoes: FaturacaoRow[] = (faturacaoRes.data ?? []).map((r: Record<string, unknown>) => ({
    mes_ano: r.mes_ano as string,
    kwh_faturado: r.kwh_faturado as number,
    valor_cve: r.valor_cve as number,
    cliente: r.clientes as {
      id: string;
      id_subestacao: string;
      nome_titular: string;
      numero_contador: string;
    } | null,
  }));

  const evolucao = calcularEvolucaoMensal(injecoes, faturacoes, meses);

  const injCurrent = injecoes
    .filter((r) => r.mes_ano === mesAno)
    .reduce((s, r) => s + r.total_kwh_injetado, 0);
  const fatCurrent = faturacoes.filter((r) => r.mes_ano === mesAno);
  const contribuidores = topContribuidores(fatCurrent, idSubestacao, injCurrent, 10);

  return { evolucao, contribuidores };
}
