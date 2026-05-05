"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RelatoriosFiltros, PerdasZonaData, SubestacaoPerdasRow } from "../types";
import { getMesesRange } from "./_shared";
import { DEFAULT_PRICE_CVE_PER_KWH } from "@/modules/balanco/lib/balanco";

export function usePerdasZonaData(filtros: RelatoriosFiltros, active: boolean) {
  const supabase = createClient();
  const [data, setData] = useState<PerdasZonaData | null>(null);
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

      const injMap: Record<string, { kwh: number; nome: string; ilha: string }> = {};
      for (const r of injecoes) {
        if (!injMap[r.id_subestacao]) {
          injMap[r.id_subestacao] = { kwh: 0, nome: r.subestacoes?.nome ?? "Desconhecida", ilha: r.subestacoes?.ilha ?? "Desconhecida" };
        }
        injMap[r.id_subestacao].kwh += r.total_kwh_injetado;
      }

      const fatMap: Record<string, number> = {};
      for (const r of faturacoes) {
        if (filtros.tipoTarifa && r.clientes?.tipo_tarifa !== filtros.tipoTarifa) continue;
        const subId = r.clientes?.id_subestacao ?? "";
        if (subId) fatMap[subId] = (fatMap[subId] ?? 0) + r.kwh_faturado;
      }

      const tabela: SubestacaoPerdasRow[] = Object.entries(injMap).map(([id, { kwh: inj, nome, ilha }]) => {
        const fat = fatMap[id] ?? 0;
        const perda_kwh = Math.max(0, inj - fat);
        const perda_pct = inj > 0 ? parseFloat(((perda_kwh / inj) * 100).toFixed(1)) : 0;
        return { id, nome, ilha, kwh_injetado: Math.round(inj), kwh_faturado: Math.round(fat), perda_kwh: Math.round(perda_kwh), perda_pct, cve_estimado: Math.round(perda_kwh * DEFAULT_PRICE_CVE_PER_KWH) };
      });
      tabela.sort((a, b) => b.perda_kwh - a.perda_kwh);

      const tabelaFiltrada = filtros.zona
        ? tabela.filter((r) => {
            const sub = injecoes.find((i) => i.id_subestacao === r.id);
            return sub?.subestacoes?.zona_bairro === filtros.zona;
          })
        : tabela;

      const top7 = tabelaFiltrada.slice(0, 7);

      const ilhaMap: Record<string, { sum: number; count: number }> = {};
      for (const r of tabelaFiltrada) {
        const ilha = r.ilha.replace(/_/g, " ").replace("Sao", "São").replace("Santo Antao", "S. Antão");
        if (!ilhaMap[ilha]) ilhaMap[ilha] = { sum: 0, count: 0 };
        ilhaMap[ilha].sum += r.perda_pct;
        ilhaMap[ilha].count++;
      }
      const radarIlha = Object.entries(ilhaMap).map(([ilha, { sum, count }]) => ({
        ilha,
        indice_risco: parseFloat((sum / count).toFixed(1)),
      }));

      const totalInjetado = tabelaFiltrada.reduce((s, r) => s + r.kwh_injetado, 0);
      const totalFaturado = tabelaFiltrada.reduce((s, r) => s + r.kwh_faturado, 0);
      const perdaKwh = totalInjetado - totalFaturado;
      const perdaPct = totalInjetado > 0 ? parseFloat(((perdaKwh / totalInjetado) * 100).toFixed(1)) : 0;

      setData({ kpis: { totalInjetado, totalFaturado, perdaKwh, perdaPct }, top7, tabela: tabelaFiltrada, radarIlha });
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
