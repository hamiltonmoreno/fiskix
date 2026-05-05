"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Zap, AlertTriangle, TrendingDown, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface SubRow {
  id: string;
  nome: string;
  zona_bairro: string;
  ilha: string;
  capacidade_kwh: number | null;
  ativo: boolean;
}

interface BalancoRow {
  id_subestacao: string;
  total_kwh_injetado: number;
  mes_ano: string;
}

interface SubStats extends SubRow {
  ultimaInjecao: number | null;
  utilizacaoPct: number | null;
  injecoesMeses: number;
  totalAlertasCriticos: number;
}

export function SubestacoesClient() {
  const supabase = useMemo(() => createClient(), []);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [injecoes, setInjecoes] = useState<BalancoRow[]>([]);
  const [alertasCont, setAlertasCont] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filtroIlha, setFiltroIlha] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"todos" | "ativo" | "inativo">("todos");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: subsData }, { data: injecoesData }, { data: alertasData }] = await Promise.all([
          supabase.from("subestacoes").select("id, nome, zona_bairro, ilha, capacidade_kwh, ativo").order("nome"),
          supabase.from("injecao_energia").select("id_subestacao, total_kwh_injetado, mes_ano").order("mes_ano", { ascending: false }).limit(300),
          supabase.from("alertas_fraude")
            .select("id, clientes!inner(id_subestacao)")
            .gte("score_risco", 75)
            .eq("status", "Pendente"),
        ]);

        setSubs(subsData ?? []);
        setInjecoes(injecoesData ?? []);

        const cont: Record<string, number> = {};
        for (const a of (alertasData ?? []) as Array<{ clientes: { id_subestacao: string } }>) {
          const sid = a.clientes.id_subestacao;
          cont[sid] = (cont[sid] ?? 0) + 1;
        }
        setAlertasCont(cont);
      } finally { setLoading(false); }
    })();
  }, [supabase]);

  const ilhas = useMemo(() => [...new Set(subs.map((s) => s.ilha))].sort(), [subs]);

  const subsStats: SubStats[] = useMemo(() => {
    return subs
      .filter((s) => {
        if (filtroIlha && s.ilha !== filtroIlha) return false;
        if (filtroAtivo === "ativo" && !s.ativo) return false;
        if (filtroAtivo === "inativo" && s.ativo) return false;
        return true;
      })
      .map((s) => {
        const subInjecoes = injecoes.filter((i) => i.id_subestacao === s.id);
        const ultimaInjecao = subInjecoes[0]?.total_kwh_injetado ?? null;
        const utilizacaoPct = s.capacidade_kwh && ultimaInjecao
          ? Math.round((ultimaInjecao / s.capacidade_kwh) * 100)
          : null;
        return {
          ...s,
          ultimaInjecao,
          utilizacaoPct,
          injecoesMeses: subInjecoes.length,
          totalAlertasCriticos: alertasCont[s.id] ?? 0,
        };
      });
  }, [subs, injecoes, alertasCont, filtroIlha, filtroAtivo]);

  const chartData = useMemo(() =>
    subsStats
      .filter((s) => s.ultimaInjecao !== null)
      .sort((a, b) => (b.ultimaInjecao ?? 0) - (a.ultimaInjecao ?? 0))
      .slice(0, 15)
      .map((s) => ({
        nome: s.nome.length > 12 ? s.nome.slice(0, 12) + "…" : s.nome,
        injecao: s.ultimaInjecao,
        capacidade: s.capacidade_kwh,
        criticos: s.totalAlertasCriticos,
      })), [subsStats]);

  const totalCapacidade = subsStats.reduce((s, r) => s + (r.capacidade_kwh ?? 0), 0);
  const totalInjecao = subsStats.reduce((s, r) => s + (r.ultimaInjecao ?? 0), 0);
  const utilizacaoGlobal = totalCapacidade > 0 ? Math.round((totalInjecao / totalCapacidade) * 100) : null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Subestações</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Capacidade, utilização e alertas críticos por subestação</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtroIlha} onChange={(e) => setFiltroIlha(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
            <option value="">Todas as ilhas</option>
            {ilhas.map((i) => <option key={i} value={i}>{i.replace(/_/g, " ")}</option>)}
          </select>
          <select value={filtroAtivo} onChange={(e) => setFiltroAtivo(e.target.value as typeof filtroAtivo)}
            className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
            <option value="todos">Todas</option>
            <option value="ativo">Ativas</option>
            <option value="inativo">Inativas</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 dark:text-gray-400">Subestações</span><Activity className="w-4 h-4 text-blue-500" /></div>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{subsStats.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 dark:text-gray-400">Capacidade total (kWh)</span><Zap className="w-4 h-4 text-amber-500" /></div>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{totalCapacidade.toLocaleString("pt-CV")}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 dark:text-gray-400">Utilização global</span><TrendingDown className="w-4 h-4 text-blue-500" /></div>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{utilizacaoGlobal !== null ? `${utilizacaoGlobal}%` : "—"}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 dark:text-gray-400">Alertas críticos (Pendente)</span><AlertTriangle className="w-4 h-4 text-red-500" /></div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{Object.values(alertasCont).reduce((s, v) => s + v, 0)}</p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Injeção mais recente por subestação (top 15)</h2>
        {loading ? <div className="h-48 bg-slate-50 dark:bg-gray-900/40 animate-pulse rounded-lg" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nome" tick={{ fontSize: 9 }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString("pt-CV")} kWh`, "Injeção"]} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
              <Bar dataKey="injecao" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.criticos > 0 ? "#ef4444" : "#3b82f6"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">Barras a vermelho = subestação com alertas críticos pendentes</p>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        {loading ? <div className="h-40 bg-slate-50 dark:bg-gray-900/40 animate-pulse" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Subestação</th>
                  <th className="px-4 py-3 text-left font-medium">Ilha</th>
                  <th className="px-4 py-3 text-right font-medium">Capacidade (kWh)</th>
                  <th className="px-4 py-3 text-right font-medium">Última injeção</th>
                  <th className="px-4 py-3 text-right font-medium">Utilização %</th>
                  <th className="px-4 py-3 text-right font-medium">Alertas críticos</th>
                  <th className="px-4 py-3 text-center font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                {subsStats.map((s) => (
                  <tr key={s.id} className={`hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors ${s.totalAlertasCriticos > 0 ? "bg-red-50/20 dark:bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-gray-100">{s.nome}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">{s.zona_bairro.replace(/_/g, " ")}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{s.ilha.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-gray-300">
                      {s.capacidade_kwh ? s.capacidade_kwh.toLocaleString("pt-CV") : <span className="text-slate-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-gray-300">
                      {s.ultimaInjecao ? s.ultimaInjecao.toLocaleString("pt-CV") : <span className="text-slate-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.utilizacaoPct !== null ? (
                        <span className={`font-semibold text-xs ${s.utilizacaoPct > 90 ? "text-red-600 dark:text-red-400" : s.utilizacaoPct > 70 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {s.utilizacaoPct}%
                        </span>
                      ) : <span className="text-slate-300 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.totalAlertasCriticos > 0 ? (
                        <span className="font-bold text-red-600 dark:text-red-400">{s.totalAlertasCriticos}</span>
                      ) : <span className="text-slate-300 dark:text-gray-600 text-xs">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.ativo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                        {s.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
