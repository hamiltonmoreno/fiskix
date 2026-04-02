"use client";

import { useEffect, useState } from "react";
import type { SubestacaoMapa } from "../types";
import { createClient } from "@/lib/supabase/client";
import { formatCVE } from "@/lib/utils";

interface HeatMapProps {
  mesAno: string;
  zona?: string;
}

function getMarkerColor(perdaPct: number): string {
  if (perdaPct >= 15) return "#DC2626"; // vermelho
  if (perdaPct >= 10) return "#D97706"; // âmbar
  return "#16A34A"; // verde
}

export function HeatMap({ mesAno, zona }: HeatMapProps) {
  const [subestacoes, setSubestacoes] = useState<SubestacaoMapa[]>([]);
  const [Map, setMap] = useState<React.ComponentType<{ subestacoes: SubestacaoMapa[]; mesAno: string }> | null>(null);
  const supabase = createClient();

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
          .filter((f) => {
            const c = f.clientes as unknown as { id_subestacao: string };
            return c?.id_subestacao === s.id;
          })
          .reduce((sum, f) => sum + f.kwh_faturado, 0);

        const perda_pct =
          kwh_injetado > 0
            ? ((kwh_injetado - kwh_faturado) / kwh_injetado) * 100
            : 0;

        const alertas_criticos = (alertas ?? []).filter((a) => {
          const c = a.clientes as unknown as { id_subestacao: string };
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
  }, [mesAno, zona]);

  if (!Map) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-700 mb-3">Mapa de Calor — Subestações</h3>
        <div className="h-80 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
          <span className="text-slate-400 text-sm">A carregar mapa...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700">Mapa de Calor — Subestações</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> &lt;10% perda
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 10-15%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> &gt;15%
          </span>
        </div>
      </div>
      <div className="h-80 rounded-lg overflow-hidden">
        <Map subestacoes={subestacoes} mesAno={mesAno} />
      </div>
    </div>
  );
}
