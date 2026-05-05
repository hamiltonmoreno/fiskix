"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface InspecaoRaw {
  resultado: string;
  tipo_fraude: string | null;
  alertas_fraude: { score_risco: number; mes_ano: string } | null;
}

const TIPOS = ["Bypass", "Contador_adulterado", "Ligacao_vizinha", "Ima", "Outro"];
const RESULTADOS = ["Fraude_Confirmada", "Anomalia_Tecnica"];
const COLORS: Record<string, string> = {
  Fraude_Confirmada: "#ef4444", Anomalia_Tecnica: "#f59e0b",
};

export function FraudesClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<InspecaoRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("relatorios_inspecao")
          .select("resultado, tipo_fraude, alertas_fraude!inner(score_risco, mes_ano)")
          .in("resultado", RESULTADOS);
        if (mesFiltro) q = (q as typeof q).eq("alertas_fraude.mes_ano", mesFiltro);
        const { data } = await q;
        setRows((data ?? []) as unknown as InspecaoRaw[]);
      } finally { setLoading(false); }
    })();
  }, [mesFiltro, supabase]);

  const meses = useMemo(() => {
    const set = new Set(rows.map((r) => r.alertas_fraude?.mes_ano).filter(Boolean));
    return [...set].sort().reverse() as string[];
  }, [rows]);

  const matrizData = useMemo(() => {
    return TIPOS.map((tipo) => {
      const entry: Record<string, string | number> = { tipo: tipo.replace(/_/g, " ") };
      for (const res of RESULTADOS) {
        entry[res] = rows.filter((r) => r.tipo_fraude === tipo && r.resultado === res).length;
      }
      entry.total = rows.filter((r) => r.tipo_fraude === tipo).length;
      return entry;
    }).filter((e) => (e.total as number) > 0);
  }, [rows]);

  const scoresPorTipo = useMemo(() => {
    return TIPOS.map((tipo) => {
      const scores = rows
        .filter((r) => r.tipo_fraude === tipo && r.alertas_fraude)
        .map((r) => r.alertas_fraude!.score_risco);
      if (!scores.length) return null;
      const sorted = [...scores].sort((a, b) => a - b);
      return {
        tipo: tipo.replace(/_/g, " "),
        media: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        mediana: sorted[Math.floor(sorted.length / 2)],
        count: scores.length,
      };
    }).filter(Boolean) as Array<{ tipo: string; media: number; mediana: number; count: number }>;
  }, [rows]);

  const semTipo = rows.filter((r) => !r.tipo_fraude).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Matriz Resultado × Tipo de Fraude</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Calibração das regras · padrões de fraude por tipo</p>
        </div>
        <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Total com tipo classificado</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{rows.length - semTipo}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Sem tipo registado</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{semTipo}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Tipo mais frequente</p>
          <p className="text-xl font-bold text-slate-900 dark:text-gray-100">
            {matrizData.sort((a, b) => (b.total as number) - (a.total as number))[0]?.tipo ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Gráfico de barras empilhadas */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Resultado por tipo de fraude</h2>
          {loading ? <div className="h-48 bg-slate-50 dark:bg-gray-900/40 animate-pulse rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={matrizData} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={120} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v.replace(/_/g, " ")} />
                {RESULTADOS.map((res) => (
                  <Bar key={res} dataKey={res} stackId="a" fill={COLORS[res]} radius={res === RESULTADOS[RESULTADOS.length - 1] ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Score por tipo */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Score médio por tipo de fraude</h2>
          {loading ? <div className="h-48 bg-slate-50 dark:bg-gray-900/40 animate-pulse rounded-lg" /> : scoresPorTipo.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400 dark:text-gray-500">Sem dados suficientes</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoresPorTipo} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} domain={[0, 100]} />
                <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={120} tickLine={false} />
                <Tooltip formatter={(v: number, name: string) => [`${v} pts`, name === "media" ? "Média" : "Mediana"]} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <Bar dataKey="media" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Média">
                  {scoresPorTipo.map((_, i) => <Cell key={i} fill="#3b82f6" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela matriz completa */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/60 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Tabela completa</h2>
        </div>
        {loading ? <div className="h-32 bg-slate-50 dark:bg-gray-900/40 animate-pulse" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tipo de Fraude</th>
                  <th className="px-4 py-3 text-right font-medium">Fraude Conf.</th>
                  <th className="px-4 py-3 text-right font-medium">Anomalia Tec.</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Score médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                {scoresPorTipo.map((s) => {
                  const matrizRow = matrizData.find((m) => m.tipo === s.tipo);
                  return (
                    <tr key={s.tipo} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-gray-100">{s.tipo}</td>
                      <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-semibold">{matrizRow?.Fraude_Confirmada ?? 0}</td>
                      <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-semibold">{matrizRow?.Anomalia_Tecnica ?? 0}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300">{s.count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-gray-300">{s.media} pts</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
