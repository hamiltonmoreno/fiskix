"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMesAno, getLastNMonths } from "@/lib/utils";
import type {
  RelatoriosFiltros,
  Periodo,
  ExecutivoData,
  InspecoesData,
  PerdasZonaData,
  RecidivismoData,
  BalancoEnergeticoData,
  AnaliseAvancadaData,
  SubestacaoPerdasRow,
  BalancoSubRow,
} from "../types";

// Platform cost per month in CVE (hardcoded constant for ROI calculation)
const PLATAFORMA_CUSTO_MENSAL = 500_000;

function periodoToN(periodo: Periodo): number {
  return { mes: 1, trimestre: 3, semestre: 6, ano: 12 }[periodo];
}

function getMesesRange(filtros: RelatoriosFiltros): string[] {
  const n = periodoToN(filtros.periodo);
  // getLastNMonths is relative to today, so filter to <= mesAno anchor
  return getLastNMonths(Math.max(n, 12)).filter((m) => m <= filtros.mesAno).slice(-n);
}

// ── useExecutivoData ────────────────────────────────────────────────────────────

export function useExecutivoData(filtros: RelatoriosFiltros, active: boolean) {
  const [data, setData] = useState<ExecutivoData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const meses = getMesesRange(filtros);

    // Parallel: alertas + injecao + faturacao
    const [alertasRes, injecaoRes, faturacaoRes] = await Promise.all([
      supabase
        .from("alertas_fraude")
        .select("mes_ano, resultado, score_risco")
        .in("mes_ano", meses),
      supabase
        .from("injecao_energia")
        .select("mes_ano, total_kwh_injetado")
        .in("mes_ano", meses),
      supabase
        .from("faturacao_clientes")
        .select("mes_ano, kwh_faturado, valor_cve")
        .in("mes_ano", meses),
    ]);

    const alertas = alertasRes.data ?? [];
    const injecoes = injecaoRes.data ?? [];
    const faturacoes = faturacaoRes.data ?? [];

    // Aggregate by month
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
        // Estimate recovered CVE: assume 500 CVE per alert confirmed (fallback when valor_cve not on alertas)
        recuperadoPorMes[a.mes_ano] = (recuperadoPorMes[a.mes_ano] ?? 0) + 15_000;
      }
    }

    // Build series
    let roiAcumulado = 0;
    const serie = meses.map((m) => {
      const inj = injecaoPorMes[m] ?? 0;
      const fat = faturacaoPorMes[m] ?? 0;
      const perdaKwh = Math.max(0, inj - fat);
      const perdaCVE = perdaKwh * 15; // 15 CVE/kWh estimate
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

    // KPIs
    const totalAlertas = alertas.length;
    const fraudesConfirmadas = alertas.filter((a) => a.resultado === "Fraude_Confirmada").length;
    const receitaRecuperada = Object.values(recuperadoPorMes).reduce((s, v) => s + v, 0);
    const taxaDetecao = totalAlertas > 0 ? (fraudesConfirmadas / totalAlertas) * 100 : 0;

    setData({
      kpis: { totalAlertas, fraudesConfirmadas, receitaRecuperada, taxaDetecao },
      serie,
    });
    } finally {
      setLoading(false);
    }
  }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

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

// ── useInspecoesData ────────────────────────────────────────────────────────────

export function useInspecoesData(filtros: RelatoriosFiltros, active: boolean) {
  const [data, setData] = useState<InspecoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const meses = getMesesRange(filtros);

    let query = supabase
      .from("alertas_fraude")
      .select(
        `resultado, status, mes_ano,
         clientes!inner(tipo_tarifa, subestacoes!inner(zona_bairro, ilha))`
      )
      .in("mes_ano", meses);

    if (filtros.zona) {
      query = query.eq("clientes.subestacoes.zona_bairro", filtros.zona);
    }
    if (filtros.tipoTarifa) {
      query = query.eq("clientes.tipo_tarifa", filtros.tipoTarifa);
    }

    const { data: rows } = await query;
    const alertas = (rows ?? []) as Array<{
      resultado: string | null;
      status: string;
      mes_ano: string;
      clientes: { tipo_tarifa: string; subestacoes: { zona_bairro: string; ilha: string } } | null;
    }>;

    // Group by zona
    const byZona: Record<string, { confirmadas: number; anomalias: number; falsosPositivos: number; pendentes: number }> = {};

    for (const a of alertas) {
      const zona = a.clientes?.subestacoes?.zona_bairro ?? "Desconhecida";
      if (!byZona[zona]) {
        byZona[zona] = { confirmadas: 0, anomalias: 0, falsosPositivos: 0, pendentes: 0 };
      }
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
  }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

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

// ── usePerdasZonaData ───────────────────────────────────────────────────────────

export function usePerdasZonaData(filtros: RelatoriosFiltros, active: boolean) {
  const [data, setData] = useState<PerdasZonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const meses = getMesesRange(filtros);

    const [injecaoRes, faturacaoRes] = await Promise.all([
      supabase
        .from("injecao_energia")
        .select("id_subestacao, mes_ano, total_kwh_injetado, subestacoes!inner(nome, ilha, zona_bairro)")
        .in("mes_ano", meses),
      supabase
        .from("faturacao_clientes")
        .select("mes_ano, kwh_faturado, valor_cve, clientes!inner(id_subestacao, tipo_tarifa)")
        .in("mes_ano", meses),
    ]);

    const injecoes = (injecaoRes.data ?? []) as Array<{
      id_subestacao: string;
      mes_ano: string;
      total_kwh_injetado: number;
      subestacoes: { nome: string; ilha: string; zona_bairro: string } | null;
    }>;

    const faturacoes = (faturacaoRes.data ?? []) as Array<{
      mes_ano: string;
      kwh_faturado: number;
      valor_cve: number;
      clientes: { id_subestacao: string; tipo_tarifa: string } | null;
    }>;

    // Aggregate injecao by subestacao
    const injMap: Record<string, { kwh: number; nome: string; ilha: string }> = {};
    for (const r of injecoes) {
      if (!injMap[r.id_subestacao]) {
        injMap[r.id_subestacao] = {
          kwh: 0,
          nome: r.subestacoes?.nome ?? "Desconhecida",
          ilha: r.subestacoes?.ilha ?? "Desconhecida",
        };
      }
      injMap[r.id_subestacao].kwh += r.total_kwh_injetado;
    }

    // Aggregate faturacao by subestacao (via clientes.id_subestacao)
    const fatMap: Record<string, number> = {};
    for (const r of faturacoes) {
      if (filtros.tipoTarifa && r.clientes?.tipo_tarifa !== filtros.tipoTarifa) continue;
      const subId = r.clientes?.id_subestacao ?? "";
      if (subId) {
        fatMap[subId] = (fatMap[subId] ?? 0) + r.kwh_faturado;
      }
    }

    const tabela: SubestacaoPerdasRow[] = Object.entries(injMap).map(([id, { kwh: inj, nome, ilha }]) => {
      const fat = fatMap[id] ?? 0;
      const perda_kwh = Math.max(0, inj - fat);
      const perda_pct = inj > 0 ? parseFloat(((perda_kwh / inj) * 100).toFixed(1)) : 0;
      return { id, nome, ilha, kwh_injetado: Math.round(inj), kwh_faturado: Math.round(fat), perda_kwh: Math.round(perda_kwh), perda_pct, cve_estimado: Math.round(perda_kwh * 15) };
    });

    tabela.sort((a, b) => b.perda_kwh - a.perda_kwh);

    // Apply zona filter if set
    const tabelaFiltrada = filtros.zona
      ? tabela.filter((r) => {
          const sub = injecoes.find((i) => i.id_subestacao === r.id);
          return sub?.subestacoes?.zona_bairro === filtros.zona;
        })
      : tabela;

    const top7 = tabelaFiltrada.slice(0, 7);

    // Radar by ilha
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
  }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

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

// ── useRecidivismoData ──────────────────────────────────────────────────────────

export function useRecidivismoData(filtros: RelatoriosFiltros, active: boolean) {
  const [data, setData] = useState<RecidivismoData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const meses = getMesesRange(filtros);

    let query = supabase
      .from("alertas_fraude")
      .select(
        `id_cliente, mes_ano, resultado,
         clientes!inner(nome_titular, numero_contador, tipo_tarifa,
           subestacoes!inner(zona_bairro))`
      )
      .eq("resultado", "Fraude_Confirmada");

    if (filtros.zona) {
      query = query.eq("clientes.subestacoes.zona_bairro", filtros.zona);
    }
    if (filtros.tipoTarifa) {
      query = query.eq("clientes.tipo_tarifa", filtros.tipoTarifa);
    }

    const { data: rows } = await query;
    const alertas = (rows ?? []) as Array<{
      id_cliente: string;
      mes_ano: string;
      resultado: string | null;
      clientes: {
        nome_titular: string;
        numero_contador: string;
        tipo_tarifa: string;
        subestacoes: { zona_bairro: string } | null;
      } | null;
    }>;

    // Group by client
    const clientMap: Record<
      string,
      { nome_titular: string; numero_contador: string; tipo_tarifa: string; zona: string; meses: string[] }
    > = {};
    for (const a of alertas) {
      if (!clientMap[a.id_cliente]) {
        clientMap[a.id_cliente] = {
          nome_titular: a.clientes?.nome_titular ?? "—",
          numero_contador: a.clientes?.numero_contador ?? "—",
          tipo_tarifa: a.clientes?.tipo_tarifa ?? "—",
          zona: a.clientes?.subestacoes?.zona_bairro ?? "—",
          meses: [],
        };
      }
      clientMap[a.id_cliente].meses.push(a.mes_ano);
    }

    // Reincidentes: 2+ confirmed alerts
    const reincidentes = Object.entries(clientMap)
      .filter(([, v]) => v.meses.length >= 2)
      .map(([id, v]) => {
        const sortedMeses = [...v.meses].sort();
        const ultimoMes = sortedMeses[sortedMeses.length - 1];
        return {
          id_cliente: id,
          nome_titular: v.nome_titular,
          numero_contador: v.numero_contador,
          tipo_tarifa: v.tipo_tarifa,
          zona: v.zona,
          total_alertas: v.meses.length,
          confirmados: v.meses.length,
          ultimo_mes: formatMesAno(ultimoMes),
        };
      })
      .sort((a, b) => b.total_alertas - a.total_alertas);

    // Monthly new reincidentes: month when a client becomes a reincidente (their 2nd confirmed alert)
    const mensalNovos: Record<string, number> = {};
    for (const m of meses) mensalNovos[m] = 0;

    for (const [, v] of Object.entries(clientMap)) {
      if (v.meses.length >= 2) {
        const sorted = [...v.meses].sort();
        const secondAlert = sorted[1]; // month when they became a reincidente
        if (meses.includes(secondAlert)) {
          mensalNovos[secondAlert] = (mensalNovos[secondAlert] ?? 0) + 1;
        }
      }
    }

    const totalUniqueClients = Object.keys(clientMap).length;
    const totalReincidentes = reincidentes.length;
    const mediaAlertas = totalReincidentes > 0
      ? parseFloat((reincidentes.reduce((s, r) => s + r.total_alertas, 0) / totalReincidentes).toFixed(1))
      : 0;
    const taxaReincidencia = totalUniqueClients > 0 ? parseFloat(((totalReincidentes / totalUniqueClients) * 100).toFixed(1)) : 0;
    const maxAlertas = reincidentes[0]?.total_alertas ?? 0;

    setData({
      kpis: { totalReincidentes, mediaAlertas, taxaReincidencia, maxAlertas },
      mensalNovos: meses.map((m) => ({ mes: formatMesAno(m).slice(0, 8), novos: mensalNovos[m] ?? 0 })),
      top10: reincidentes.slice(0, 10),
      tabela: reincidentes,
    });
    } finally {
      setLoading(false);
    }
  }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

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

// ── useAnaliseAvancadaData ──────────────────────────────────────────────────────

export function useAnaliseAvancadaData(filtros: RelatoriosFiltros, active: boolean) {
  const [data, setData] = useState<AnaliseAvancadaData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meses = getMesesRange(filtros);

      // Carregar configuração de perdas técnicas
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

      // Agregar por subestação
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

      // Alertas por subestação
      const alertasSubMap: Record<string, { total: number; alto: number }> = {};
      for (const a of alertas) {
        const sid = a.clientes?.id_subestacao ?? "";
        if (sid) {
          if (!alertasSubMap[sid]) alertasSubMap[sid] = { total: 0, alto: 0 };
          alertasSubMap[sid].total++;
          if (a.score_risco >= 75) alertasSubMap[sid].alto++;
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
        const irec = sub_alertas.total > 0
          ? parseFloat(((sub_alertas.alto / sub_alertas.total) * perda_pct).toFixed(1))
          : 0;
        return {
          id, nome, zona_bairro, kwh_injetado: Math.round(inj), perda_kwh: Math.round(perda_kwh),
          perda_pct, perda_tecnica_kwh, perda_comercial_kwh, perda_comercial_pct,
          cve_comercial_estimado, irec, alertas_alto_score: sub_alertas.alto, total_alertas: sub_alertas.total,
        };
      }).sort((a, b) => b.perda_comercial_kwh - a.perda_comercial_kwh);

      // Filtrar por zona
      const porSubFiltrada = filtros.zona
        ? porSubestacao.filter((r) => r.zona_bairro === filtros.zona)
        : porSubestacao;

      // Evolução mensal comercial vs técnica
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

      // KPIs globais
      const perda_total_kwh = porSubFiltrada.reduce((s, r) => s + r.perda_kwh, 0);
      const perda_tecnica_kwh = porSubFiltrada.reduce((s, r) => s + r.perda_tecnica_kwh, 0);
      const perda_comercial_kwh = porSubFiltrada.reduce((s, r) => s + r.perda_comercial_kwh, 0);

      setData({
        kpis: {
          perda_total_kwh,
          perda_tecnica_kwh,
          perda_comercial_kwh,
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
  }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

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

// ── useBalancoEnergeticoData ────────────────────────────────────────────────────

export function useBalancoEnergeticoData(filtros: RelatoriosFiltros, active: boolean) {
  const [data, setData] = useState<BalancoEnergeticoData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const meses = getMesesRange(filtros);

    const [injecaoRes, faturacaoRes] = await Promise.all([
      supabase
        .from("injecao_energia")
        .select("id_subestacao, mes_ano, total_kwh_injetado, subestacoes!inner(nome, ilha, zona_bairro)")
        .in("mes_ano", meses),
      supabase
        .from("faturacao_clientes")
        .select("mes_ano, kwh_faturado, valor_cve, clientes!inner(id_subestacao, tipo_tarifa)")
        .in("mes_ano", meses),
    ]);

    const injecoes = (injecaoRes.data ?? []) as Array<{
      id_subestacao: string;
      mes_ano: string;
      total_kwh_injetado: number;
      subestacoes: { nome: string; ilha: string; zona_bairro: string } | null;
    }>;

    const faturacoes = (faturacaoRes.data ?? []) as Array<{
      mes_ano: string;
      kwh_faturado: number;
      valor_cve: number;
      clientes: { id_subestacao: string; tipo_tarifa: string } | null;
    }>;

    // Per-subestacao aggregation
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

    // Apply zona filter
    const porSubFiltrada = filtros.zona
      ? porSubestacao.filter((r) => {
          const sub = injecoes.find((i) => i.id_subestacao === r.id);
          return sub?.subestacoes?.zona_bairro === filtros.zona;
        })
      : porSubestacao;

    // Evolução perda by mes
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
  }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

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
