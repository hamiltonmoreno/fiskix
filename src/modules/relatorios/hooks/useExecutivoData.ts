"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatMesAno } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { RelatoriosFiltros, ExecutivoData } from "../types";
import { PLATAFORMA_CUSTO_MENSAL, getMesesRange } from "./_shared";
import { DEFAULT_PRICE_CVE_PER_KWH } from "@/modules/balanco/lib/balanco";

export function useExecutivoData(filtros: RelatoriosFiltros, active: boolean) {
  const supabase = createClient();
  const [data, setData] = useState<ExecutivoData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meses = getMesesRange(filtros);

      const [alertasRes, injecaoRes, faturacaoRes] = await Promise.all([
        supabase.from("alertas_fraude").select("mes_ano, resultado, score_risco").in("mes_ano", meses),
        supabase.from("injecao_energia").select("mes_ano, total_kwh_injetado").in("mes_ano", meses),
        supabase.from("faturacao_clientes").select("mes_ano, kwh_faturado, valor_cve").in("mes_ano", meses),
      ]);

      const alertas = alertasRes.data ?? [];
      const injecoes = injecaoRes.data ?? [];
      const faturacoes = faturacaoRes.data ?? [];

      const injecaoPorMes: Record<string, number> = {};
      for (const r of injecoes) {
        injecaoPorMes[r.mes_ano] = (injecaoPorMes[r.mes_ano] ?? 0) + r.total_kwh_injetado;
      }

      const faturacaoPorMes: Record<string, number> = {};
      const valorCVEPorMes: Record<string, number> = {};
      for (const r of faturacoes) {
        faturacaoPorMes[r.mes_ano] = (faturacaoPorMes[r.mes_ano] ?? 0) + r.kwh_faturado;
        valorCVEPorMes[r.mes_ano] = (valorCVEPorMes[r.mes_ano] ?? 0) + r.valor_cve;
      }

      const recuperadoPorMes: Record<string, number> = {};
      for (const a of alertas) {
        if (a.resultado === "Fraude_Confirmada") {
          recuperadoPorMes[a.mes_ano] = (recuperadoPorMes[a.mes_ano] ?? 0) + 15_000;
        }
      }

      let roiAcumulado = 0;
      const serie = meses.map((m) => {
        const inj = injecaoPorMes[m] ?? 0;
        const fat = faturacaoPorMes[m] ?? 0;
        const perdaKwh = Math.max(0, inj - fat);
        const perdaCVE = perdaKwh * DEFAULT_PRICE_CVE_PER_KWH;
        const recuperado = recuperadoPorMes[m] ?? 0;
        const roi = recuperado - PLATAFORMA_CUSTO_MENSAL;
        roiAcumulado += roi;
        return {
          mes: formatMesAno(m).replace(/de /g, "").replace(/^\w/, (c) => c.toUpperCase()).slice(0, 8),
          mesRaw: m,
          perda: Math.round(perdaCVE),
          recuperado: Math.round(recuperado),
          roi: Math.round(roi),
          roiAcumulado: Math.round(roiAcumulado),
        };
      });

      const totalAlertas = alertas.length;
      const fraudesConfirmadas = alertas.filter((a) => a.resultado === "Fraude_Confirmada").length;
      const receitaRecuperada = Object.values(recuperadoPorMes).reduce((s, v) => s + v, 0);
      const taxaDetecao = totalAlertas > 0 ? (fraudesConfirmadas / totalAlertas) * 100 : 0;

      setData({ kpis: { totalAlertas, fraudesConfirmadas, receitaRecuperada, taxaDetecao }, serie });
    } finally {
      setLoading(false);
    }
  }, [filtros]); // filtros é objeto — dep inteira causaria loop; reset via primitivos no effect acima

  useEffect(() => {
    hasFetched.current = false;
  }, [filtros.mesAno, filtros.zona, filtros.tipoTarifa, filtros.periodo]);

  useEffect(() => {
    if (!active || hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [active, load]);

  return { data, loading };
}
