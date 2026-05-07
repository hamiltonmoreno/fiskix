"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { createClient } from "@/lib/supabase/client";

interface InspecaoRaw {
  id: string;
  criado_em: string;
  resultado: string;
  tipo_fraude: string | null;
  id_fiscal: string;
  perfis: { nome_completo: string } | null;
  alertas_fraude: { score_risco: number; mes_ano: string; criado_em: string };
}

interface FiscalStats {
  id: string;
  nome: string;
  total: number;
  confirmadas: number;
  anomalias: number;
  falsos: number;
  taxaConfirmacao: number;
  scoreMediano: number;
  tempoMedioHoras: number | null;
}

export function FiscaisClient() {
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
          .select(
            "id, criado_em, resultado, tipo_fraude, id_fiscal, perfis!relatorios_inspecao_id_fiscal_fkey(nome_completo), alertas_fraude!inner(score_risco, mes_ano, criado_em)"
          )
          .order("criado_em", { ascending: false });

        if (mesFiltro) {
          q = q.eq("alertas_fraude.mes_ano", mesFiltro);
        }

        const { data } = await q;
        setRows((data ?? []) as unknown as InspecaoRaw[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [mesFiltro, supabase]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(rows.map((r) => r.alertas_fraude.mes_ano));
    return [...set].sort().reverse();
  }, [rows]);

  const fiscaisStats: FiscalStats[] = useMemo(() => {
    const map = new Map<string, InspecaoRaw[]>();
    for (const r of rows) {
      const list = map.get(r.id_fiscal) ?? [];
      list.push(r);
      map.set(r.id_fiscal, list);
    }

    return [...map.entries()].map(([id, inspecoes]) => {
      const confirmadas = inspecoes.filter((i) => i.resultado === "Fraude_Confirmada").length;
      const anomalias = inspecoes.filter((i) => i.resultado === "Anomalia_Tecnica").length;
      const falsos = inspecoes.filter((i) => i.resultado === "Falso_Positivo").length;
      const scores = inspecoes.map((i) => i.alertas_fraude.score_risco).sort((a, b) => a - b);
      const scoreMediano = scores[Math.floor(scores.length / 2)] ?? 0;

      const tempos = inspecoes
        .map((i) => {
          const alerta = new Date(i.alertas_fraude.criado_em).getTime();
          const inspecao = new Date(i.criado_em).getTime();
          return (inspecao - alerta) / 3600000;
        })
        .filter((t) => t > 0 && t < 720);

      const tempoMedioHoras = tempos.length
        ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length)
        : null;

      return {
        id,
        nome: inspecoes[0].perfis?.nome_completo ?? "Fiscal desconhecido",
        total: inspecoes.length,
        confirmadas,
        anomalias,
        falsos,
        taxaConfirmacao: inspecoes.length > 0 ? Math.round((confirmadas / inspecoes.length) * 100) : 0,
        scoreMediano,
        tempoMedioHoras,
      };
    }).sort((a, b) => b.total - a.total);
  }, [rows]);

  const totais = useMemo(() => ({
    total: rows.length,
    confirmadas: rows.filter((r) => r.resultado === "Fraude_Confirmada").length,
    anomalias: rows.filter((r) => r.resultado === "Anomalia_Tecnica").length,
    falsos: rows.filter((r) => r.resultado === "Falso_Positivo").length,
  }), [rows]);

  const tiposFraudeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.tipo_fraude) map.set(r.tipo_fraude, (map.get(r.tipo_fraude) ?? 0) + 1);
    }
    return [...map.entries()].map(([tipo, count]) => ({ tipo: tipo.replace(/_/g, " "), count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Performance de Fiscais</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Eficácia operacional da equipa de campo</p>
        </div>
        <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none">
          <option value="">Todos os meses</option>
          {mesesDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* KPIs globais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Users} label="Total inspeções" value={totais.total} tone="blue" />
        <KpiCard icon={CheckCircle2} label="Fraudes confirmadas" value={totais.confirmadas} tone="red" />
        <KpiCard icon={AlertCircle} label="Anomalias técnicas" value={totais.anomalias} tone="amber" />
        <KpiCard icon={XCircle} label="Falsos positivos" value={totais.falsos} tone="slate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Tipos de fraude */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Tipos de fraude confirmados</h2>
          {tiposFraudeData.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-slate-400 dark:text-gray-500">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tiposFraudeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={110} tickLine={false} />
                <Tooltip formatter={(v: number) => [v, "Casos"]} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {tiposFraudeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela de fiscais */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Performance por fiscal</h2>
          </div>
          {loading ? (
            <div className="h-40 bg-slate-50 dark:bg-gray-900/40 animate-pulse" />
          ) : fiscaisStats.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-gray-500">Sem dados de inspeções</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Fiscal</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-right font-medium">Confirmadas</th>
                    <th className="px-4 py-3 text-right font-medium">Taxa %</th>
                    <th className="px-4 py-3 text-right font-medium">Score mediano</th>
                    <th className="px-4 py-3 text-right font-medium">Tempo médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                  {fiscaisStats.map((f) => (
                    <tr key={f.id} className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-gray-100">{f.nome}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300">{f.total}</td>
                      <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-semibold">{f.confirmadas}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${f.taxaConfirmacao >= 50 ? "text-red-600 dark:text-red-400" : f.taxaConfirmacao >= 25 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {f.taxaConfirmacao}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-gray-300">{f.scoreMediano} pts</td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-gray-400 text-xs">
                        {f.tempoMedioHoras !== null ? (
                          <span className="flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" />{f.tempoMedioHoras}h
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: "red" | "amber" | "slate" | "blue" }) {
  const palette = { red: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400", amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400", slate: "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400", blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" };
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${palette[tone]}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
