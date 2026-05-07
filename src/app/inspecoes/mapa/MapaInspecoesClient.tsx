"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";

const MapaDesviosLeaflet = dynamic(() => import("./MapaDesviosLeaflet"), { ssr: false, loading: () => <div className="h-[480px] bg-slate-100 dark:bg-gray-900/40 animate-pulse rounded-xl" /> });

export interface InspecaoPonto {
  id: string;
  resultado: string;
  cliente_lat: number;
  cliente_lng: number;
  foto_lat: number;
  foto_lng: number;
  distancia_m: number;
  nome_titular: string;
  numero_contador: string;
  nome_fiscal: string;
}

function haversineMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MapaInspecoesClient() {
  const supabase = useMemo(() => createClient(), []);
  const [pontos, setPontos] = useState<InspecaoPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroResultado, setFiltroResultado] = useState("todos");
  const [limiarMetros, setLimiarMetros] = useState(200);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("relatorios_inspecao")
          .select("id, resultado, foto_lat, foto_lng, perfis!relatorios_inspecao_id_fiscal_fkey(nome_completo), alertas_fraude!inner(clientes!inner(nome_titular, numero_contador, lat, lng))")
          .not("foto_lat", "is", null)
          .not("foto_lng", "is", null);

        const list: InspecaoPonto[] = [];
        for (const r of (data ?? []) as never[]) {
          const row = r as {
            id: string; resultado: string; foto_lat: number; foto_lng: number;
            perfis: { nome_completo: string } | null;
            alertas_fraude: { clientes: { nome_titular: string; numero_contador: string; lat: number | null; lng: number | null } };
          };
          const c = row.alertas_fraude.clientes;
          if (c.lat == null || c.lng == null) continue;
          const dist = Math.round(haversineMetros(c.lat, c.lng, row.foto_lat, row.foto_lng));
          list.push({
            id: row.id,
            resultado: row.resultado,
            cliente_lat: c.lat, cliente_lng: c.lng,
            foto_lat: row.foto_lat, foto_lng: row.foto_lng,
            distancia_m: dist,
            nome_titular: c.nome_titular,
            numero_contador: c.numero_contador,
            nome_fiscal: row.perfis?.nome_completo ?? "—",
          });
        }
        setPontos(list);
      } finally { setLoading(false); }
    })();
  }, [supabase]);

  const pontosFiltrados = useMemo(() => pontos.filter((p) => {
    if (filtroResultado !== "todos" && p.resultado !== filtroResultado) return false;
    return true;
  }), [pontos, filtroResultado]);

  const suspeitos = pontosFiltrados.filter((p) => p.distancia_m > limiarMetros);
  const ok = pontosFiltrados.filter((p) => p.distancia_m <= limiarMetros);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Mapa de Inspeções</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Validação geográfica · desvio entre morada registada e localização da foto
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filtroResultado} onChange={(e) => setFiltroResultado(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
            <option value="todos">Todos os resultados</option>
            <option value="Fraude_Confirmada">Fraude Confirmada</option>
            <option value="Anomalia_Tecnica">Anomalia Técnica</option>
            <option value="Falso_Positivo">Falso Positivo</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-gray-400">Limiar desvio:</label>
            <select value={limiarMetros} onChange={(e) => setLimiarMetros(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
              {[50, 100, 200, 500, 1000].map((v) => <option key={v} value={v}>{v}m</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Inspeções com GPS</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{pontosFiltrados.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <p className="text-xs text-slate-500 dark:text-gray-400">Desvio &gt; {limiarMetros}m (suspeito)</p>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{suspeitos.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-xs text-slate-500 dark:text-gray-400">Dentro do limiar</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{ok.length}</p>
        </div>
      </div>

      {/* Mapa */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden mb-6">
        {loading ? (
          <div className="h-[480px] bg-slate-50 dark:bg-gray-900/40 animate-pulse flex items-center justify-center">
            <MapPin className="w-8 h-8 text-slate-300 dark:text-gray-600" />
          </div>
        ) : (
          <MapaDesviosLeaflet pontos={pontosFiltrados} limiarMetros={limiarMetros} />
        )}
      </div>

      {/* Tabela suspeitos */}
      {suspeitos.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-red-200 dark:border-red-500/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Desvios suspeitos (&gt; {limiarMetros}m)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Fiscal</th>
                  <th className="px-4 py-3 text-left font-medium">Resultado</th>
                  <th className="px-4 py-3 text-right font-medium">Desvio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50 dark:divide-red-500/10">
                {suspeitos.sort((a, b) => b.distancia_m - a.distancia_m).slice(0, 50).map((p) => (
                  <tr key={p.id} className="hover:bg-red-50/40 dark:hover:bg-red-500/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-gray-100">{p.nome_titular}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">{p.numero_contador}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300 text-xs">{p.nome_fiscal}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${p.resultado === "Fraude_Confirmada" ? "text-red-600 dark:text-red-400" : p.resultado === "Anomalia_Tecnica" ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-gray-400"}`}>
                        {p.resultado.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                      {p.distancia_m >= 1000 ? `${(p.distancia_m / 1000).toFixed(1)} km` : `${p.distancia_m} m`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
