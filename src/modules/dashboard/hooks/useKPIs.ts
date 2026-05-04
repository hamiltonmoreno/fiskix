"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { KPIData } from "../types";

export function useKPIs(mesAno: string, zona?: string) {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Query de alertas do mês atual
      let query = supabase
        .from("alertas_fraude")
        .select(
          `score_risco, status, resultado,
           clientes!inner(id_subestacao,
             subestacoes!inner(zona_bairro)
           )`
        )
        .eq("mes_ano", mesAno);

      const { data: alertas } = await query;

      const alertasArr = (alertas ?? []) as Array<{
        score_risco: number;
        status: string;
        resultado: string | null;
        clientes: { subestacoes: { zona_bairro: string } };
      }>;

      const filtrados = zona
        ? alertasArr.filter(
            (a) => a.clientes?.subestacoes?.zona_bairro === zona
          )
        : alertasArr;

      const criticos = filtrados.filter((a) => a.score_risco >= 75).length;
      const pendentes = filtrados.filter(
        (a) => a.status === "Pendente_Inspecao"
      ).length;

      // Receita recuperada YTD (fraudes confirmadas no ano corrente)
      const ano = mesAno.split("-")[0];
      let recQuery = supabase
        .from("relatorios_inspecao")
        .select(
          zona
            ? `alertas_fraude!inner(mes_ano, id_cliente,
                clientes!inner(id_subestacao, faturacao_clientes(valor_cve, mes_ano),
                  subestacoes!inner(zona_bairro)
                )
              )`
            : `alertas_fraude!inner(mes_ano, id_cliente,
                clientes!inner(faturacao_clientes(valor_cve, mes_ano))
              )`
        )
        .eq("resultado", "Fraude_Confirmada");
      if (zona) {
        recQuery = (recQuery as typeof recQuery).eq(
          "alertas_fraude.clientes.subestacoes.zona_bairro",
          zona,
        );
      }
      const { data: recuperada } = await recQuery;

      // PostgREST returns FK joins as arrays when the relationship is one-to-many,
      // and as a single object when it's many-to-one. relatorios_inspecao→alertas_fraude
      // is many-to-one, but defensively support both shapes.
      type FatRow = { valor_cve: number; mes_ano: string };
      type AlertaJoined = {
        mes_ano: string;
        clientes: { faturacao_clientes: FatRow[] } | { faturacao_clientes: FatRow[] }[];
      };
      const receitaYTD = (recuperada ?? []).reduce((sum: number, r: unknown) => {
        const item = r as { alertas_fraude: AlertaJoined | AlertaJoined[] };
        const alerta = Array.isArray(item.alertas_fraude)
          ? item.alertas_fraude[0]
          : item.alertas_fraude;
        const mesAlerta = alerta?.mes_ano;
        if (!mesAlerta?.startsWith(ano)) return sum;
        const cliente = Array.isArray(alerta.clientes) ? alerta.clientes[0] : alerta.clientes;
        const faturacao = cliente?.faturacao_clientes ?? [];
        const fatMes = faturacao.find((f) => f.mes_ano === mesAlerta);
        return sum + (fatMes?.valor_cve ?? 0);
      }, 0);

      // Perda CVE total estimada — mês atual e mês anterior para calcular variação
      const mesAnterior = (() => {
        const [y, m] = mesAno.split("-").map(Number);
        const d = new Date(y, m - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })();

      // Queries de energia — filtradas por zona quando selecionada
      let injecoesQuery = supabase
        .from("injecao_energia")
        .select(zona ? "total_kwh_injetado, subestacoes!inner(zona_bairro)" : "total_kwh_injetado")
        .eq("mes_ano", mesAno);
      let injecoesAntQuery = supabase
        .from("injecao_energia")
        .select(zona ? "total_kwh_injetado, subestacoes!inner(zona_bairro)" : "total_kwh_injetado")
        .eq("mes_ano", mesAnterior);
      let fatQuery = supabase
        .from("faturacao_clientes")
        .select(zona ? "kwh_faturado, valor_cve, clientes!inner(subestacoes!inner(zona_bairro))" : "kwh_faturado, valor_cve")
        .eq("mes_ano", mesAno);
      let fatAntQuery = supabase
        .from("faturacao_clientes")
        .select(zona ? "kwh_faturado, clientes!inner(subestacoes!inner(zona_bairro))" : "kwh_faturado")
        .eq("mes_ano", mesAnterior);

      if (zona) {
        injecoesQuery = (injecoesQuery as typeof injecoesQuery).eq("subestacoes.zona_bairro", zona);
        injecoesAntQuery = (injecoesAntQuery as typeof injecoesAntQuery).eq("subestacoes.zona_bairro", zona);
        fatQuery = (fatQuery as typeof fatQuery).eq("clientes.subestacoes.zona_bairro", zona);
        fatAntQuery = (fatAntQuery as typeof fatAntQuery).eq("clientes.subestacoes.zona_bairro", zona);
      }

      const [
        { data: injecoes },
        { data: faturacaoTotal },
        { data: injecoesAnt },
        { data: faturacaoAnt },
      ] = await Promise.all([injecoesQuery, fatQuery, injecoesAntQuery, fatAntQuery]);

      const totalInjetado = ((injecoes ?? []) as unknown as Array<{ total_kwh_injetado: number }>).reduce((s, i) => s + i.total_kwh_injetado, 0);
      const totalFaturado = ((faturacaoTotal ?? []) as unknown as Array<{ kwh_faturado: number; valor_cve: number }>).reduce((s, f) => s + f.kwh_faturado, 0);
      const totalCVEFaturado = ((faturacaoTotal ?? []) as unknown as Array<{ kwh_faturado: number; valor_cve: number }>).reduce((s, f) => s + f.valor_cve, 0);

      const perdaKwh = totalInjetado - totalFaturado;
      // When there is no faturação for the month, we cannot derive a real tariff
      // from the data — return 0 perdaCVE rather than inflating with a synthetic
      // 15 CVE/kWh fallback that turns a "no data" month into a fake huge loss.
      const tarifaMedia = totalFaturado > 0 ? totalCVEFaturado / totalFaturado : 0;
      const perdaCVE = tarifaMedia > 0 ? perdaKwh * tarifaMedia : 0;

      // Variação vs mês anterior
      const totalInjetadoAnt = ((injecoesAnt ?? []) as unknown as Array<{ total_kwh_injetado: number }>).reduce((s, i) => s + i.total_kwh_injetado, 0);
      const totalFaturadoAnt = ((faturacaoAnt ?? []) as unknown as Array<{ kwh_faturado: number }>).reduce((s, f) => s + f.kwh_faturado, 0);
      const perdaKwhAnt = totalInjetadoAnt - totalFaturadoAnt;
      const perdaCVEAnt = tarifaMedia > 0 ? perdaKwhAnt * tarifaMedia : 0;
      const variacaoPerda =
        perdaCVEAnt > 0 ? ((perdaCVE - perdaCVEAnt) / perdaCVEAnt) * 100 : 0;

      setData({
        perda_cve_total: Math.max(0, perdaCVE),
        clientes_risco_critico: criticos,
        ordens_pendentes: pendentes,
        receita_recuperada_ytd: receitaYTD,
        variacao_perda_pct: Math.round(variacaoPerda * 10) / 10,
      });

      setLoading(false);
    }

    load();
  }, [mesAno, zona]);

  return { data, loading };
}
