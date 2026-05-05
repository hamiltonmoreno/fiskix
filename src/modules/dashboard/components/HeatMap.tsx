"use client";

import { useEffect, useState, useMemo } from "react";
import type { SubestacaoMapa } from "../types";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { joinedRow } from "@/lib/supabase/types";

interface HeatMapProps {
  mesAno: string;
  zona?: string;
}


export function HeatMap({ mesAno, zona }: HeatMapProps) {
  const [subestacoes, setSubestacoes] = useState<SubestacaoMapa[]>([]);
  const [Map, setMap] = useState<React.ComponentType<{ subestacoes: SubestacaoMapa[]; mesAno: string }> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Carregar Leaflet apenas no cliente (SSR não suporta)
    import("./LeafletMap").then((m) => setMap(() => m.LeafletMap));
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

      const mapa: SubestacaoMapa[] = (subs ?? []).map((s) => {
        const inj = injecoes?.find((i) => i.id_subestacao === s.id);
        const kwh_injetado = inj?.total_kwh_injetado ?? 0;

        const kwh_faturado = (fatClientes ?? [])
          .filter((f) => joinedRow<{ id_subestacao: string }>(f.clientes)?.id_subestacao === s.id)
          .reduce((sum, f) => sum + f.kwh_faturado, 0);

        const perda_pct =
          kwh_injetado > 0
            ? ((kwh_injetado - kwh_faturado) / kwh_injetado) * 100
            : 0;

        const alertas_criticos = (alertas ?? []).filter(
          (a) => joinedRow<{ id_subestacao: string }>(a.clientes)?.id_subestacao === s.id,
        ).length;

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
      <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subestações</p>
        <p className="font-bold text-on-surface mb-4">Mapa de Calor — Perdas por Zona</p>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Subestações</p>
          <p className="font-bold text-on-surface">Mapa de Calor — Perdas por Zona</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> &lt;10%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 10–15%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> &gt;15%
          </span>
        </div>
      </div>
      <div className="h-[22rem] rounded-xl [overflow:clip]">
        <Map subestacoes={subestacoes} mesAno={mesAno} />
      </div>
    </div>
  );
}
