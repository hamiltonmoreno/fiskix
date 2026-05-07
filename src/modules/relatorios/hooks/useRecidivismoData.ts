"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatMesAno } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { RelatoriosFiltros, RecidivismoData } from "../types";
import { getMesesRange } from "./_shared";

export function useRecidivismoData(filtros: RelatoriosFiltros, active: boolean) {
  const supabase = createClient();
  const [data, setData] = useState<RecidivismoData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meses = getMesesRange(filtros);

      let query = supabase
        .from("alertas_fraude")
        .select(`id_cliente, mes_ano, resultado, clientes!inner(nome_titular, numero_contador, tipo_tarifa, subestacoes!inner(zona_bairro))`)
        .eq("resultado", "Fraude_Confirmada");

      if (filtros.zona) query = query.eq("clientes.subestacoes.zona_bairro", filtros.zona);
      if (filtros.tipoTarifa) query = query.eq("clientes.tipo_tarifa", filtros.tipoTarifa);

      const { data: rows } = await query;
      const alertas = (rows ?? []) as Array<{
        id_cliente: string; mes_ano: string; resultado: string | null;
        clientes: { nome_titular: string; numero_contador: string; tipo_tarifa: string; subestacoes: { zona_bairro: string } | null } | null;
      }>;

      const clientMap: Record<string, { nome_titular: string; numero_contador: string; tipo_tarifa: string; zona: string; meses: string[] }> = {};
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
        clientMap[a.id_cliente]!.meses.push(a.mes_ano);
      }

      const reincidentes = Object.entries(clientMap)
        .filter(([, v]) => v.meses.length >= 2)
        .map(([id, v]) => {
          const sortedMeses = [...v.meses].sort();
          return {
            id_cliente: id,
            nome_titular: v.nome_titular,
            numero_contador: v.numero_contador,
            tipo_tarifa: v.tipo_tarifa,
            zona: v.zona,
            total_alertas: v.meses.length,
            confirmados: v.meses.length,
            ultimo_mes: formatMesAno(sortedMeses[sortedMeses.length - 1]!),
          };
        })
        .sort((a, b) => b.total_alertas - a.total_alertas);

      const mensalNovos: Record<string, number> = {};
      for (const m of meses) mensalNovos[m] = 0;
      for (const [, v] of Object.entries(clientMap)) {
        if (v.meses.length >= 2) {
          const secondAlert = [...v.meses].sort()[1];
          if (secondAlert && meses.includes(secondAlert)) {
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
