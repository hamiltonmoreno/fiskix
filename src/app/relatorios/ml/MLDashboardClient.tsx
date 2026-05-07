"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Brain, TrendingUp, GitMerge, BarChart2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from "recharts";

interface MlRow {
  mes_ano: string;
  score_ml: number;
  modelo_versao: string;
  features_json: Record<string, number> | null;
  id_cliente: string;
  alertas_fraude: { score_risco: number; resultado: string | null } | null;
}

interface ConfigRow { chave: string; valor: string }

const FEATURE_LABELS: Record<string, string> = {
  f_queda: "Queda", f_cv: "Variância", f_zscore: "Z-score",
  f_slope: "Tendência", f_ratio_pico: "Pico", f_alertas_12m: "Reincid.", f_perda_zona: "Zona",
};

export function MLDashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const [predicoes, setPredicoes] = useState<MlRow[]>([]);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("configuracoes").select("chave, valor").in("chave", ["ml_modelo_ativo", "ml_pesos_v1", "ml_rmse_historico", "ml_inspecoes_promote_threshold"]),
    ]).then(([{ data }]) => setConfigs(data ?? []));
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("ml_predicoes")
          .select("mes_ano, score_ml, modelo_versao, features_json, id_cliente, alertas_fraude(score_risco, resultado)")
          .order("mes_ano", { ascending: false })
          .limit(500);
        if (mesFiltro) q = q.eq("mes_ano", mesFiltro);
        const { data } = await q;
        setPredicoes((data ?? []) as unknown as MlRow[]);
      } finally { setLoading(false); }
    })();
  }, [mesFiltro, supabase]);

  const modeloAtivo = configs.find((c) => c.chave === "ml_modelo_ativo")?.valor ?? "heuristic_v1";
  const threshold = configs.find((c) => c.chave === "ml_inspecoes_promote_threshold")?.valor ?? "100";

  const rmseHistorico = useMemo(() => {
    const raw = configs.find((c) => c.chave === "ml_rmse_historico")?.valor;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as Array<{ mes_ano: string; rmse: number; n_amostras: number }> : [];
    } catch { return []; }
  }, [configs]);

  const meses = useMemo(() => [...new Set(predicoes.map((p) => p.mes_ano))].sort().reverse(), [predicoes]);

  const scatterData = useMemo(() => predicoes
    .filter((p) => p.alertas_fraude)
    .map((p) => ({ x: p.alertas_fraude!.score_risco, y: Math.round(p.score_ml * 100), resultado: p.alertas_fraude!.resultado }))
    .slice(0, 200), [predicoes]);

  const pesosML = useMemo(() => {
    const raw = configs.find((c) => c.chave === "ml_pesos_v1")?.valor;
    if (!raw) return null;
    try { return JSON.parse(raw) as Record<string, number>; } catch { return null; }
  }, [configs]);

  const versoes = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of predicoes) map.set(p.modelo_versao, (map.get(p.modelo_versao) ?? 0) + 1);
    return [...map.entries()];
  }, [predicoes]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Dashboard do Modelo ML</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Qualidade, evolução e explainability do scoring ML</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${modeloAtivo === "logistic_v1" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"}`}>
            {modeloAtivo}
          </span>
          <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
            <option value="">Todos os meses</option>
            {meses.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-gray-400">Predições (filtro atual)</span>
            <Brain className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{predicoes.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-gray-400">RMSE mais recente</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">
            {rmseHistorico.length ? rmseHistorico[rmseHistorico.length - 1].rmse.toFixed(3) : "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-gray-400">Threshold promoção</span>
            <GitMerge className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{threshold} insp.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 dark:text-gray-400">Versões ativas</span>
            <BarChart2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{versoes.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* RMSE histórico */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Evolução do RMSE</h2>
          {rmseHistorico.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400 dark:text-gray-500">RMSE calculado no cron do dia 2</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={rmseHistorico} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes_ano" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 1]} />
                <Tooltip formatter={(v: number) => [v.toFixed(4), "RMSE"]} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <Line type="monotone" dataKey="rmse" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Score regras vs score ML */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-1">Score regras vs. Score ML</h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mb-3">Concordância entre os dois modelos (amostra 200)</p>
          {loading ? <div className="h-40 bg-slate-50 dark:bg-gray-900/40 animate-pulse rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <ScatterChart margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="Score regras" tick={{ fontSize: 9 }} domain={[0, 100]} label={{ value: "Score regras", position: "insideBottom", offset: -4, fontSize: 9 }} />
                <YAxis type="number" dataKey="y" name="Score ML %" tick={{ fontSize: 9 }} domain={[0, 100]} />
                <ZAxis range={[20, 20]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: number, name: string) => [v, name]} contentStyle={{ borderRadius: "8px", fontSize: 11 }} />
                <Scatter data={scatterData} fill="#3b82f6" fillOpacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pesos ML */}
      {pesosML && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Pesos do modelo ({modeloAtivo})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(pesosML).map(([key, peso]) => (
              <div key={key} className="text-center">
                <div className="h-2 rounded-full bg-slate-100 dark:bg-gray-700 mb-2 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (peso as number) * 100 * 2)}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-gray-400">{FEATURE_LABELS[`f_${key.replace("_peso", "").replace("_pct", "")}`] ?? key}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-gray-200">{((peso as number) * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
