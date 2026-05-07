"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Legend } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { BarChart2 } from "lucide-react";

interface AlertaRaw { score_risco: number; mes_ano: string; status: string }

const BINS = [
  { label: "0–9", min: 0, max: 9 }, { label: "10–19", min: 10, max: 19 },
  { label: "20–29", min: 20, max: 29 }, { label: "30–39", min: 30, max: 39 },
  { label: "40–49", min: 40, max: 49 }, { label: "50–59", min: 50, max: 59 },
  { label: "60–69", min: 60, max: 69 }, { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 }, { label: "90–100", min: 90, max: 100 },
];

function calcPercentil(scores: number[], p: number) {
  if (!scores.length) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

export function DistribuicaoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [alertas, setAlertas] = useState<AlertaRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let q = supabase.from("alertas_fraude").select("score_risco, mes_ano, status").order("mes_ano", { ascending: false });
        if (mesFiltro) q = q.eq("mes_ano", mesFiltro);
        const { data } = await q;
        setAlertas(data ?? []);
      } finally { setLoading(false); }
    })();
  }, [mesFiltro, supabase]);

  const meses = useMemo(() => {
    const set = new Set(alertas.map((a) => a.mes_ano));
    return [...set].sort().reverse();
  }, [alertas]);

  const scores = alertas.map((a) => a.score_risco);

  const histograma = useMemo(() => BINS.map((bin) => ({
    label: bin.label,
    count: scores.filter((s) => s >= bin.min && s <= bin.max).length,
    isMedio: bin.min >= 50 && bin.max < 75,
    isCritico: bin.min >= 75,
  })), [scores]);

  const percentis = useMemo(() => ({
    p50: calcPercentil(scores, 50),
    p75: calcPercentil(scores, 75),
    p90: calcPercentil(scores, 90),
    p99: calcPercentil(scores, 99),
  }), [scores]);

  const tendencia = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const a of alertas) {
      const list = map.get(a.mes_ano) ?? [];
      list.push(a.score_risco);
      map.set(a.mes_ano, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, s]) => ({
        mes: mes.slice(0, 7),
        media: Math.round(s.reduce((x, v) => x + v, 0) / s.length),
        criticos: s.filter((v) => v >= 75).length,
        medios: s.filter((v) => v >= 50 && v < 75).length,
      }));
  }, [alertas]);

  const total = scores.length;
  const criticos = scores.filter((s) => s >= 75).length;
  const medios = scores.filter((s) => s >= 50 && s < 75).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Distribuição de Scores</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Análise estatística · calibração dos limiares</p>
        </div>
        <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Percentis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "P50 (Mediana)", value: percentis.p50, tone: "slate" },
          { label: "P75", value: percentis.p75, tone: "amber" },
          { label: "P90", value: percentis.p90, tone: "amber" },
          { label: "P99", value: percentis.p99, tone: "red" },
        ].map(({ label, value, tone }) => (
          <div key={label} className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${tone === "red" ? "text-red-600 dark:text-red-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-gray-100"}`}>
              {value} pts
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Histograma */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-1">Histograma</h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mb-4">{total} alertas · {criticos} críticos · {medios} médios</p>
          {loading ? <div className="h-48 bg-slate-50 dark:bg-gray-900/40 animate-pulse rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={histograma} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [v, "Alertas"]} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <ReferenceLine x="50–59" stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "MÉDIO", position: "top", fontSize: 9 }} />
                <ReferenceLine x="70–79" stroke="#ef4444" strokeDasharray="3 3" label={{ value: "CRÍTICO", position: "top", fontSize: 9 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histograma.map((bin, i) => (
                    <rect key={i} fill={bin.isCritico ? "#ef4444" : bin.isMedio ? "#f59e0b" : "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tendência mensal */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Evolução mensal (últimos 12 meses)</h2>
          {loading ? <div className="h-48 bg-slate-50 dark:bg-gray-900/40 animate-pulse rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tendencia} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="criticos" stroke="#ef4444" strokeWidth={2} dot={false} name="Críticos" />
                <Line type="monotone" dataKey="medios" stroke="#f59e0b" strokeWidth={2} dot={false} name="Médios" />
                <Line type="monotone" dataKey="media" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Score médio" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela bins detalhada */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/60 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Detalhe por intervalo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Intervalo</th>
                <th className="px-4 py-3 text-right font-medium">Alertas</th>
                <th className="px-4 py-3 text-right font-medium">% do total</th>
                <th className="px-4 py-3 text-left font-medium">Classe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
              {histograma.map((bin) => (
                <tr key={bin.label} className={`${bin.isCritico ? "bg-red-50/40 dark:bg-red-500/5" : bin.isMedio ? "bg-amber-50/40 dark:bg-amber-500/5" : ""}`}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-gray-300">{bin.label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-gray-100">{bin.count}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 dark:text-gray-400">
                    {total > 0 ? `${((bin.count / total) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {bin.isCritico && <span className="text-xs font-semibold text-red-600 dark:text-red-400">CRÍTICO</span>}
                    {bin.isMedio && <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">MÉDIO</span>}
                    {!bin.isCritico && !bin.isMedio && <span className="text-xs text-slate-400 dark:text-gray-500">Abaixo do limiar</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
