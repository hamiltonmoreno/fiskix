"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RelatoriosFiltros, InspecoesData } from "../types";
import { getMesesRange } from "./_shared";

export function useInspecoesData(filtros: RelatoriosFiltros, active: boolean) {
  const supabase = createClient();
  const [data, setData] = useState<InspecoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meses = getMesesRange(filtros);

      let query = supabase
        .from("alertas_fraude")
        .select(`resultado, status, mes_ano, clientes!inner(tipo_tarifa, subestacoes!inner(zona_bairro, ilha))`)
        .in("mes_ano", meses);

      if (filtros.zona) query = query.eq("clientes.subestacoes.zona_bairro", filtros.zona);
      if (filtros.tipoTarifa) query = query.eq("clientes.tipo_tarifa", filtros.tipoTarifa);

      const { data: rows } = await query;
      const alertas = (rows ?? []) as Array<{
        resultado: string | null;
        status: string;
        mes_ano: string;
        clientes: { tipo_tarifa: string; subestacoes: { zona_bairro: string; ilha: string } } | null;
      }>;

      const byZona: Record<string, { confirmadas: number; anomalias: number; falsosPositivos: number; pendentes: number }> = {};
      for (const a of alertas) {
        const zona = a.clientes?.subestacoes?.zona_bairro ?? "Desconhecida";
        if (!byZona[zona]) byZona[zona] = { confirmadas: 0, anomalias: 0, falsosPositivos: 0, pendentes: 0 };
        if (a.resultado === "Fraude_Confirmada") byZona[zona].confirmadas++;
        else if (a.resultado === "Anomalia_Tecnica") byZona[zona].anomalias++;
        else if (a.resultado === "Falso_Positivo") byZona[zona].falsosPositivos++;
        else byZona[zona].pendentes++;
      }

      const porZona = Object.entries(byZona).map(([zona, counts]) => {
        const total = counts.confirmadas + counts.anomalias + counts.falsosPositivos + counts.pendentes;
        const inspecionados = counts.confirmadas + counts.anomalias + counts.falsosPositivos;
        return {
          zona,
          ...counts,
          total,
          taxaSucesso: inspecionados > 0 ? Math.round((counts.confirmadas / inspecionados) * 100) : 0,
        };
      });

      const totals = {
        confirmadas: alertas.filter((a) => a.resultado === "Fraude_Confirmada").length,
        anomalias: alertas.filter((a) => a.resultado === "Anomalia_Tecnica").length,
        falsosPositivos: alertas.filter((a) => a.resultado === "Falso_Positivo").length,
        pendentes: alertas.filter((a) => !a.resultado).length,
      };
      const total = alertas.length;
      const inspecionados = totals.confirmadas + totals.anomalias + totals.falsosPositivos;
      const taxaSucesso = inspecionados > 0 ? Math.round((totals.confirmadas / inspecionados) * 100) : 0;

      setData({
        kpis: { total, confirmadas: totals.confirmadas, falsosPositivos: totals.falsosPositivos, taxaSucesso },
        porZona,
        donut: [
          { name: "Fraude Confirmada", value: totals.confirmadas, color: "#22C55E" },
          { name: "Anomalia Técnica", value: totals.anomalias, color: "#F59E0B" },
          { name: "Falso Positivo", value: totals.falsosPositivos, color: "#94A3B8" },
          { name: "Pendente", value: totals.pendentes, color: "#3B82F6" },
        ],
      });
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
