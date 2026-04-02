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
      const { data: recuperada } = await supabase
        .from("relatorios_inspecao")
        .select(
          `alertas_fraude!inner(mes_ano, id_cliente,
            clientes!inner(faturacao_clientes(valor_cve, mes_ano))
          )`
        )
        .eq("resultado", "Fraude_Confirmada");

      const receitaYTD = (recuperada ?? []).reduce((sum: number) => {
        // Estimativa: valor médio de faturação do cliente
        return sum + 15000; // placeholder — calcular corretamente via JOIN
      }, 0);

      // Perda CVE total estimada
      const { data: injecoes } = await supabase
        .from("injecao_energia")
        .select("total_kwh_injetado, id_subestacao")
        .eq("mes_ano", mesAno);

      const { data: faturacaoTotal } = await supabase
        .from("faturacao_clientes")
        .select("kwh_faturado, valor_cve")
        .eq("mes_ano", mesAno);

      const totalInjetado = (injecoes ?? []).reduce(
        (s, i) => s + i.total_kwh_injetado,
        0
      );
      const totalFaturado = (faturacaoTotal ?? []).reduce(
        (s, f) => s + f.kwh_faturado,
        0
      );
      const totalCVEFaturado = (faturacaoTotal ?? []).reduce(
        (s, f) => s + f.valor_cve,
        0
      );

      const perdaKwh = totalInjetado - totalFaturado;
      const tarifaMedia =
        totalFaturado > 0 ? totalCVEFaturado / totalFaturado : 15; // CVE/kWh
      const perdaCVE = perdaKwh * tarifaMedia;

      setData({
        perda_cve_total: Math.max(0, perdaCVE),
        clientes_risco_critico: criticos,
        ordens_pendentes: pendentes,
        receita_recuperada_ytd: receitaYTD,
        variacao_perda_pct: 0, // TODO: comparar com mês anterior
      });

      setLoading(false);
    }

    load();
  }, [mesAno, zona]);

  return { data, loading };
}
