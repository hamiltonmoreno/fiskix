"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatMesAno } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { RelatoriosFiltros, AnaliseAvancadaData } from "../types";
import { getMesesRange } from "./_shared";
import { SCORE_CRITICO } from "@/modules/scoring/constants";

export function useAnaliseAvancadaData(filtros: RelatoriosFiltros, active: boolean) {
  const supabase = createClient();
  const [data, setData] = useState<AnaliseAvancadaData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meses = getMesesRange(filtros);

      const [configRes, injecaoRes, faturacaoRes, alertasRes] = await Promise.all([
        supabase.from("configuracoes").select("chave, valor").in("chave", ["perda_tecnica_estimada_pct", "limiar_perda_zona_pct"]),
        supabase.from("injecao_energia").select("id_subestacao, mes_ano, total_kwh_injetado, subestacoes!inner(nome, zona_bairro, ilha)").in("mes_ano", meses),
        supabase.from("faturacao_clientes").select("mes_ano, kwh_faturado, valor_cve, clientes!inner(id_subestacao)").in("mes_ano", meses),
        supabase.from("alertas_fraude").select("id_cliente, score_risco, mes_ano, clientes!inner(id_subestacao)").in("mes_ano", meses).gte("score_risco", 50),
      ]);

      const cfg: Record<string, number> = {};
      for (const c of configRes.data ?? []) cfg[c.chave] = parseFloat(c.valor);
      const perdaTecnicaPct = cfg.perda_tecnica_estimada_pct ?? 5;

      const injecoes = (injecaoRes.data ?? []) as Array<{
        id_subestacao: string; mes_ano: string; total_kwh_injetado: number;
        subestacoes: { nome: string; zona_bairro: string; ilha: string } | null;
      }>;
      const faturacoes = (faturacaoRes.data ?? []) as Array<{
        mes_ano: string; kwh_faturado: number; valor_cve: number;
        clientes: { id_subestacao: string } | null;
      }>;
      const alertas = (alertasRes.data ?? []) as Array<{
        id_cliente: string; score_risco: number; mes_ano: string;
        clientes: { id_subestacao: string } | null;
      }>;

      const injSubMap: Record<string, { kwh: number; nome: string; zona_bairro: string }> = {};
      const injMesMap: Record<string, number> = {};
      for (const r of injecoes) {
        if (!injSubMap[r.id_subestacao]) {
          injSubMap[r.id_subestacao] = { kwh: 0, nome: r.subestacoes?.nome ?? "—", zona_bairro: r.subestacoes?.zona_bairro ?? "—" };
        }
        injSubMap[r.id_subestacao].kwh += r.total_kwh_injetado;
        injMesMap[r.mes_ano] = (injMesMap[r.mes_ano] ?? 0) + r.total_kwh_injetado;
      }

      const fatSubMap: Record<string, number> = {};
      const cveSubMap: Record<string, number> = {};
      const fatMesMap: Record<string, number> = {};
      for (const r of faturacoes) {
        const sid = r.clientes?.id_subestacao ?? "";
        if (sid) {
          fatSubMap[sid] = (fatSubMap[sid] ?? 0) + r.kwh_faturado;
          cveSubMap[sid] = (cveSubMap[sid] ?? 0) + r.valor_cve;
        }
        fatMesMap[r.mes_ano] = (fatMesMap[r.mes_ano] ?? 0) + r.kwh_faturado;
      }

      const alertasSubMap: Record<string, { total: number; alto: number }> = {};
      for (const a of alertas) {
        const sid = a.clientes?.id_subestacao ?? "";
        if (sid) {
          if (!alertasSubMap[sid]) alertasSubMap[sid] = { total: 0, alto: 0 };
          alertasSubMap[sid].total++;
          if (a.score_risco >= SCORE_CRITICO) alertasSubMap[sid].alto++;
        }
      }

      const porSubestacao = Object.entries(injSubMap).map(([id, { kwh: inj, nome, zona_bairro }]) => {
        const fat = fatSubMap[id] ?? 0;
        const perda_kwh = Math.max(0, inj - fat);
        const perda_pct = inj > 0 ? parseFloat(((perda_kwh / inj) * 100).toFixed(2)) : 0;
        const perda_tecnica_kwh = Math.round(inj * (perdaTecnicaPct / 100));
        const perda_comercial_kwh = Math.max(0, Math.round(perda_kwh - perda_tecnica_kwh));
        const perda_comercial_pct = perda_kwh > 0 ? parseFloat(((perda_comercial_kwh / perda_kwh) * 100).toFixed(1)) : 0;
        const tarifa = fat > 0 ? (cveSubMap[id] ?? 0) / fat : 15;
        const cve_comercial_estimado = Math.round(perda_comercial_kwh * tarifa);
        const sub_alertas = alertasSubMap[id] ?? { total: 0, alto: 0 };
        const irec = sub_alertas.total > 0 ? parseFloat(((sub_alertas.alto / sub_alertas.total) * perda_pct).toFixed(1)) : 0;
        return {
          id, nome, zona_bairro, kwh_injetado: Math.round(inj), perda_kwh: Math.round(perda_kwh),
          perda_pct, perda_tecnica_kwh, perda_comercial_kwh, perda_comercial_pct,
          cve_comercial_estimado, irec, alertas_alto_score: sub_alertas.alto, total_alertas: sub_alertas.total,
        };
      }).sort((a, b) => b.perda_comercial_kwh - a.perda_comercial_kwh);

      const porSubFiltrada = filtros.zona ? porSubestacao.filter((r) => r.zona_bairro === filtros.zona) : porSubestacao;

      const evolucaoComercial = meses.map((m) => {
        const inj = injMesMap[m] ?? 0;
        const fat = fatMesMap[m] ?? 0;
        const perda = Math.max(0, inj - fat);
        const tecnica = inj * (perdaTecnicaPct / 100);
        const comercial = Math.max(0, perda - tecnica);
        return {
          mes: formatMesAno(m).slice(0, 8),
          pct_comercial: inj > 0 ? parseFloat(((comercial / inj) * 100).toFixed(2)) : 0,
          pct_tecnica: inj > 0 ? parseFloat(((tecnica / inj) * 100).toFixed(2)) : perdaTecnicaPct,
        };
      });

      const perda_total_kwh = porSubFiltrada.reduce((s, r) => s + r.perda_kwh, 0);
      const perda_tecnica_kwh = porSubFiltrada.reduce((s, r) => s + r.perda_tecnica_kwh, 0);
      const perda_comercial_kwh = porSubFiltrada.reduce((s, r) => s + r.perda_comercial_kwh, 0);

      setData({
        kpis: {
          perda_total_kwh, perda_tecnica_kwh, perda_comercial_kwh,
          perda_comercial_pct: perda_total_kwh > 0 ? parseFloat(((perda_comercial_kwh / perda_total_kwh) * 100).toFixed(1)) : 0,
          cve_comercial_estimado: porSubFiltrada.reduce((s, r) => s + r.cve_comercial_estimado, 0),
          perda_tecnica_estimada_pct: perdaTecnicaPct,
        },
        porSubestacao: porSubFiltrada,
        evolucaoComercial,
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
