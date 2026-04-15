"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatMesAno } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { RelatoriosFiltros, BalancoEnergeticoData, BalancoSubRow } from "../types";
import { getMesesRange } from "./_shared";

export function useBalancoEnergeticoData(filtros: RelatoriosFiltros, active: boolean) {
  const supabase = createClient();
  const [data, setData] = useState<BalancoEnergeticoData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meses = getMesesRange(filtros);

      const [injecaoRes, faturacaoRes] = await Promise.all([
        supabase.from("injecao_energia").select("id_subestacao, mes_ano, total_kwh_injetado, subestacoes!inner(nome, ilha, zona_bairro)").in("mes_ano", meses),
        supabase.from("faturacao_clientes").select("mes_ano, kwh_faturado, valor_cve, clientes!inner(id_subestacao, tipo_tarifa)").in("mes_ano", meses),
      ]);

      const injecoes = (injecaoRes.data ?? []) as Array<{
        id_subestacao: string; mes_ano: string; total_kwh_injetado: number;
        subestacoes: { nome: string; ilha: string; zona_bairro: string } | null;
      }>;
      const faturacoes = (faturacaoRes.data ?? []) as Array<{
        mes_ano: string; kwh_faturado: number; valor_cve: number;
        clientes: { id_subestacao: string; tipo_tarifa: string } | null;
      }>;

      const injSubMap: Record<string, { kwh: number; nome: string; ilha: string }> = {};
      const injMesMap: Record<string, number> = {};
      for (const r of injecoes) {
        if (!injSubMap[r.id_subestacao]) {
          injSubMap[r.id_subestacao] = { kwh: 0, nome: r.subestacoes?.nome ?? "Desconhecida", ilha: r.subestacoes?.ilha ?? "—" };
        }
        injSubMap[r.id_subestacao].kwh += r.total_kwh_injetado;
        injMesMap[r.mes_ano] = (injMesMap[r.mes_ano] ?? 0) + r.total_kwh_injetado;
      }

      const fatSubMap: Record<string, number> = {};
      const fatMesMap: Record<string, number> = {};
      for (const r of faturacoes) {
        if (filtros.tipoTarifa && r.clientes?.tipo_tarifa !== filtros.tipoTarifa) continue;
        const subId = r.clientes?.id_subestacao ?? "";
        if (subId) fatSubMap[subId] = (fatSubMap[subId] ?? 0) + r.kwh_faturado;
        fatMesMap[r.mes_ano] = (fatMesMap[r.mes_ano] ?? 0) + r.kwh_faturado;
      }

      const porSubestacao: BalancoSubRow[] = Object.entries(injSubMap).map(([id, { kwh: inj, nome, ilha }]) => {
        const fat = fatSubMap[id] ?? 0;
        const perda_kwh = Math.max(0, inj - fat);
        const perda_pct = inj > 0 ? parseFloat(((perda_kwh / inj) * 100).toFixed(1)) : 0;
        return { id, nome: nome.slice(0, 12), ilha, kwh_injetado: Math.round(inj), kwh_faturado: Math.round(fat), perda_kwh: Math.round(perda_kwh), perda_pct, cve_estimado: Math.round(perda_kwh * 15) };
      });

      const porSubFiltrada = filtros.zona
        ? porSubestacao.filter((r) => {
            const sub = injecoes.find((i) => i.id_subestacao === r.id);
            return sub?.subestacoes?.zona_bairro === filtros.zona;
          })
        : porSubestacao;

      const evolucaoPerda = meses.map((m) => {
        const inj = injMesMap[m] ?? 0;
        const fat = fatMesMap[m] ?? 0;
        const pct = inj > 0 ? parseFloat((((inj - fat) / inj) * 100).toFixed(2)) : 0;
        return { mes: formatMesAno(m).slice(0, 8), pct };
      });

      const totalInjetado = porSubFiltrada.reduce((s, r) => s + r.kwh_injetado, 0);
      const totalFaturado = porSubFiltrada.reduce((s, r) => s + r.kwh_faturado, 0);
      const perdaKwh = totalInjetado - totalFaturado;
      const perdaPct = totalInjetado > 0 ? parseFloat(((perdaKwh / totalInjetado) * 100).toFixed(1)) : 0;

      setData({ kpis: { totalInjetado, totalFaturado, perdaKwh, perdaPct }, porSubestacao: porSubFiltrada, evolucaoPerda });
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
