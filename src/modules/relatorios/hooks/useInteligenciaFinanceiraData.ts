"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RelatoriosFiltros, InteligenciaFinanceiraData, DevedorRow, DividaPorSubestacaoRow } from "../types";
import { getMesesRange } from "./_shared";
import { LIMIAR_DIVIDA_CVE } from "@/modules/scoring/constants";

const TOP_DEVEDORES_LIMIT = 10;

export function useInteligenciaFinanceiraData(filtros: RelatoriosFiltros, active: boolean) {
  const supabase = createClient();
  const [data, setData] = useState<InteligenciaFinanceiraData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meses = getMesesRange(filtros);

      const [configRes, faturacaoRes, alertasRes] = await Promise.all([
        supabase.from("configuracoes").select("chave, valor").in("chave", ["limiar_divida_acumulada_cve"]),
        supabase
          .from("faturacao_clientes")
          .select(
            "id_cliente, mes_ano, saldo_atual_cve, tipo_leitura, clientes!inner(numero_contador, nome_titular, id_subestacao, subestacoes!inner(nome, zona_bairro))"
          )
          .in("mes_ano", meses),
        supabase.from("alertas_fraude").select("id_cliente, score_risco, mes_ano").in("mes_ano", meses),
      ]);

      const cfg: Record<string, number> = {};
      for (const c of configRes.data ?? []) cfg[c.chave] = parseFloat(c.valor);
      const limiarDivida = cfg.limiar_divida_acumulada_cve ?? LIMIAR_DIVIDA_CVE;

      type FaturaRow = {
        id_cliente: string;
        mes_ano: string;
        saldo_atual_cve: number | null;
        tipo_leitura: string | null;
        clientes: {
          numero_contador: string;
          nome_titular: string;
          id_subestacao: string;
          subestacoes: { nome: string; zona_bairro: string } | null;
        } | null;
      };
      const faturas = (faturacaoRes.data ?? []) as FaturaRow[];
      const alertas = (alertasRes.data ?? []) as Array<{ id_cliente: string; score_risco: number; mes_ano: string }>;

      // Filtrar por zona se especificada
      const zonaFiltro = filtros.zona;
      const faturasFiltradas = zonaFiltro
        ? faturas.filter((f) => f.clientes?.subestacoes?.zona_bairro === zonaFiltro)
        : faturas;

      // Pega o saldo do mês mais recente do filtro para cada cliente (último mês com dado).
      const mesAlvo = filtros.mesAno;
      const saldoMesAlvo = new Map<string, FaturaRow>();
      for (const f of faturasFiltradas) {
        if (f.mes_ano === mesAlvo) {
          saldoMesAlvo.set(f.id_cliente, f);
        }
      }

      // KPIs
      let dividaTotalCve = 0;
      let clientesEmDivida = 0;
      for (const [, f] of saldoMesAlvo) {
        const s = f.saldo_atual_cve ?? 0;
        dividaTotalCve += s;
        if (s >= limiarDivida) clientesEmDivida++;
      }

      const totalLeituras = faturasFiltradas.length;
      const estimadas = faturasFiltradas.filter((f) => f.tipo_leitura === "estimada").length;
      const pctEstimadas = totalLeituras > 0 ? (estimadas / totalLeituras) * 100 : 0;

      // Score risco mais recente por cliente (alerta com mes_ano mais alto)
      const scorePorCliente = new Map<string, number>();
      for (const a of alertas) {
        const cur = scorePorCliente.get(a.id_cliente);
        if (cur === undefined || a.score_risco > cur) {
          scorePorCliente.set(a.id_cliente, a.score_risco);
        }
      }

      // Top devedores
      const topDevedores: DevedorRow[] = Array.from(saldoMesAlvo.values())
        .filter((f) => (f.saldo_atual_cve ?? 0) > 0 && f.clientes !== null)
        .map((f) => ({
          id_cliente: f.id_cliente,
          numero_contador: f.clientes!.numero_contador,
          nome_titular: f.clientes!.nome_titular,
          zona_bairro: f.clientes!.subestacoes?.zona_bairro ?? "—",
          saldo_atual_cve: f.saldo_atual_cve ?? 0,
          score_risco: scorePorCliente.get(f.id_cliente) ?? 0,
        }))
        .sort((a, b) => b.saldo_atual_cve - a.saldo_atual_cve)
        .slice(0, TOP_DEVEDORES_LIMIT);

      // Dívida agregada por subestação
      const subMap = new Map<string, DividaPorSubestacaoRow>();
      for (const [, f] of saldoMesAlvo) {
        const c = f.clientes;
        if (!c) continue;
        const sid = c.id_subestacao;
        if (!subMap.has(sid)) {
          subMap.set(sid, {
            id_subestacao: sid,
            nome: c.subestacoes?.nome ?? "—",
            zona_bairro: c.subestacoes?.zona_bairro ?? "—",
            divida_total_cve: 0,
            clientes_em_divida: 0,
          });
        }
        const row = subMap.get(sid)!;
        const saldo = f.saldo_atual_cve ?? 0;
        row.divida_total_cve += saldo;
        if (saldo >= limiarDivida) row.clientes_em_divida++;
      }
      const porSubestacao = Array.from(subMap.values())
        .filter((r) => r.divida_total_cve > 0)
        .sort((a, b) => b.divida_total_cve - a.divida_total_cve);

      // Distribuição tipo de leitura
      const tipoCount = new Map<string, number>();
      for (const f of faturasFiltradas) {
        const t = f.tipo_leitura ?? "sem_dado";
        tipoCount.set(t, (tipoCount.get(t) ?? 0) + 1);
      }
      const distribuicaoTipoLeitura = Array.from(tipoCount.entries())
        .map(([tipo, count]) => ({
          tipo,
          count,
          pct: totalLeituras > 0 ? (count / totalLeituras) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      setData({
        kpis: {
          divida_total_cve: Math.round(dividaTotalCve),
          clientes_em_divida: clientesEmDivida,
          pct_leituras_estimadas: Math.round(pctEstimadas * 10) / 10,
          limiar_divida_cve: limiarDivida,
        },
        topDevedores,
        porSubestacao,
        distribuicaoTipoLeitura,
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
