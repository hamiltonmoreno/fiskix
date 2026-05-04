"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLastNMonths } from "@/lib/utils";
import {
  agregarKPIs,
  calcularBalancoPorSubestacao,
  calcularEvolucaoMensal,
  topContribuidores,
  type BalancoKPIs,
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

function shiftMesAno(mesAno: string, deltaMeses: number): string {
  const [y, m] = mesAno.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useBalanco(filtros: BalancoFiltros) {
  const [data, setData] = useState<BalancoData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const lastFetched = useRef<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const nMeses = filtros.nMeses ?? 12;
    const meses = getLastNMonths(nMeses).filter((m) => m <= filtros.mesAno).slice(-nMeses);
    const yoyMes = shiftMesAno(filtros.mesAno, -12);
    const mesesPlusYoy = Array.from(new Set([...meses, yoyMes]));

    const [injecaoRes, faturacaoRes] = await Promise.all([
      supabase
        .from("injecao_energia")
        .select("id_subestacao, mes_ano, total_kwh_injetado, subestacoes!inner(nome, ilha, zona_bairro)")
        .in("mes_ano", mesesPlusYoy),
      supabase
        .from("faturacao_clientes")
        .select("mes_ano, kwh_faturado, valor_cve, clientes!inner(id, id_subestacao, tipo_tarifa)")
        .in("mes_ano", mesesPlusYoy),
    ]);

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

    const porSubestacao = calcularBalancoPorSubestacao(injCurrent, fatCurrent, {
      zona: filtros.zona,
      tipoTarifa: filtros.tipoTarifa,
    });

    const kpis = agregarKPIs(porSubestacao);

    // Trend over last N months
    const evolucao = calcularEvolucaoMensal(
      allInjecoes.filter((r) => meses.includes(r.mes_ano)),
      allFaturacoes.filter((r) => meses.includes(r.mes_ano)),
      meses,
      { zona: filtros.zona, tipoTarifa: filtros.tipoTarifa },
    );

    // YoY comparison
    const injYoY = allInjecoes.filter((r) => r.mes_ano === yoyMes);
    const fatYoY = allFaturacoes.filter((r) => r.mes_ano === yoyMes);
    const porSubYoY = calcularBalancoPorSubestacao(injYoY, fatYoY, {
      zona: filtros.zona,
      tipoTarifa: filtros.tipoTarifa,
    });
    const kpisYoY = agregarKPIs(porSubYoY);
    const yoy = porSubYoY.length > 0
      ? {
          perdaPct: kpisYoY.perdaPct,
          perdaKwh: kpisYoY.perdaKwh,
          deltaPct: Math.round((kpis.perdaPct - kpisYoY.perdaPct) * 10) / 10,
        }
      : undefined;

    setData({ kpis, porSubestacao, evolucao, yoy });
    setLoading(false);
  }, [filtros.mesAno, filtros.zona, filtros.tipoTarifa, filtros.nMeses]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const key = JSON.stringify(filtros);
    if (lastFetched.current === key) return;
    lastFetched.current = key;
    load();
  }, [filtros, load]);

  return { data, loading, reload: load };
}

export async function fetchDrillDown(
  idSubestacao: string,
  mesAno: string,
  nMeses = 6,
): Promise<DrillDownData> {
  const supabase = createClient();
  const meses = getLastNMonths(nMeses).filter((m) => m <= mesAno).slice(-nMeses);

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
