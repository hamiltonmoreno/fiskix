"use client";

import { useEffect, useState, useMemo } from "react";
import type { SubestacaoMapa } from "@/modules/dashboard/types";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { appColors } from "../charts/RechartsConfig";

interface DashboardCardHeatMapProps {
  mesAno: string;
  zona?: string;
}

export function DashboardCardHeatMap({ mesAno, zona }: DashboardCardHeatMapProps) {
  const [subestacoes, setSubestacoes] = useState<SubestacaoMapa[]>([]);
  const [Map, setMap] = useState<React.ComponentType<{ subestacoes: SubestacaoMapa[]; mesAno: string }> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Carregar Leaflet apenas no cliente (SSR não suporta)
    import("@/modules/dashboard/components/LeafletMap").then((m) => setMap(() => m.LeafletMap));
  }, []);

  useEffect(() => {
    async function load() {
      const { data: subs } = await supabase
        .from("subestacoes")
        .select("id, nome, zona_bairro, lat, lng")
        .eq("ativo", true);

      const { data: injecoes } = await supabase
        .from("injecao_energia")
        .select("id_subestacao, total_kwh_injetado")
        .eq("mes_ano", mesAno);

      const { data: alertas } = await supabase
        .from("alertas_fraude")
        .select("id, score_risco, clientes!inner(id_subestacao)")
        .eq("mes_ano", mesAno)
        .gte("score_risco", 75);

      const { data: fatClientes } = await supabase
        .from("faturacao_clientes")
        .select("kwh_faturado, clientes!inner(id_subestacao)")
        .eq("mes_ano", mesAno);

      const mapa: SubestacaoMapa[] = (subs || []).map((s) => {
        const inj = injecoes?.find((i) => i.id_subestacao === s.id);
        const kwh_injetado = inj?.total_kwh_injetado || 0;

        const kwh_faturado = (fatClientes || [])
          .filter((f) => {
            const c = f.clientes as any;
            return c?.id_subestacao === s.id;
          })
          .reduce((sum, f) => sum + f.kwh_faturado, 0);

        const perda_pct = kwh_injetado > 0 ? ((kwh_injetado - kwh_faturado) / kwh_injetado) * 100 : 0;

        const alertas_criticos = (alertas || []).filter((a) => {
          const c = a.clientes as any;
          return c?.id_subestacao === s.id;
        }).length;

        return {
          id: s.id,
          nome: s.nome,
          zona_bairro: s.zona_bairro,
          lat: s.lat,
          lng: s.lng,
          perda_pct,
          kwh_injetado,
          kwh_faturado,
          alertas_criticos,
        };
      });

      setSubestacoes(zona ? mapa.filter((s) => s.zona_bairro === zona) : mapa);
    }

    load();
  }, [mesAno, zona, supabase]);

  if (!Map) {
    return (
      <div className="flex flex-col col-span-full xl:col-span-8 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Mapa de Calor — Perdas por Zona</h2>
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Subestações</div>
        </div>
        <Skeleton className="h-[22rem] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col col-span-full xl:col-span-8 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
      <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700/60">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Mapa de Perdas Geográficas</h2>
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Subestações ativas</div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: appColors.success }} /> &lt;10%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: appColors.warning }} /> 10–15%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: appColors.danger }} /> &gt;15%
          </span>
        </div>
      </div>
      
      <div className="h-[24rem] rounded-b-xl overflow-hidden relative z-0">
        {/* The map needs relative positioning and low z-index so dropdowns stay on top */}
        <Map subestacoes={subestacoes} mesAno={mesAno} />
      </div>
    </div>
  );
}
