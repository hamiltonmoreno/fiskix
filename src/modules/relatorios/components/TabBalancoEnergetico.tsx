"use client";

import { useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { Zap, TrendingDown, Activity, AlertTriangle } from "lucide-react";
import { formatKWh, formatCVE } from "@/lib/utils";
import { useBalancoEnergeticoData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

export function TabBalancoEnergetico({ filtros, active, onExportReady }: Props) {
  const { data, loading } = useBalancoEnergeticoData(filtros, active);

  useEffect(() => {
    if (!data) return;
    const headers = ["Subestação", "Ilha", "Injetado (kWh)", "Faturado (kWh)", "Perda (kWh)", "Perda (%)", "CVE Estimado"];
    const rows: ExportRow[] = data.porSubestacao.map((r) => ({
      "Subestação": r.nome,
      "Ilha": r.ilha,
      "Injetado (kWh)": r.kwh_injetado,
      "Faturado (kWh)": r.kwh_faturado,
      "Perda (kWh)": r.perda_kwh,
      "Perda (%)": r.perda_pct,
      "CVE Estimado": r.cve_estimado,
    }));
    onExportReady(headers, rows);
  }, [data, onExportReady]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Total Injetado</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data ? formatKWh(data.kpis.totalInjetado) : "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">energia fornecida à rede</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Total Faturado</span>
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data ? formatKWh(data.kpis.totalFaturado) : "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">cobrado aos clientes</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">kWh Perdidos</span>
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data ? formatKWh(data.kpis.perdaKwh) : "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">{data ? `≈ ${formatCVE(data.kpis.perdaKwh * 15)}` : ""}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">% Perda Global</span>
            <div className={`p-2 rounded-lg ${(data?.kpis.perdaPct ?? 0) > 15 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className={`text-2xl font-bold ${(data?.kpis.perdaPct ?? 0) > 15 ? "text-red-700" : "text-slate-900"}`}>
              {data ? `${data.kpis.perdaPct}%` : "—"}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">da rede no período</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* BarChart by subestacao */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Injetado vs Faturado por Subestação</h3>
          {loading ? (
            <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
          ) : (data?.porSubestacao ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Sem dados para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.porSubestacao} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={55}
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatKWh(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="kwh_injetado" name="Injetado" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="kwh_faturado" name="Faturado" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* LineChart evolução perda % */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Evolução da % de Perda Global</h3>
          {loading ? (
            <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data?.evolucaoPerda} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  domain={[0, "auto"]}
                />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                <Line
                  type="monotone"
                  dataKey="pct"
                  name="% Perda"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#EF4444" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Balanço por Subestação</h3>
        </div>
        {loading ? (
          <div className="h-40 bg-slate-50 animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Subestação</th>
                  <th className="px-5 py-3 text-left font-medium">Ilha</th>
                  <th className="px-5 py-3 text-right font-medium">Injetado (kWh)</th>
                  <th className="px-5 py-3 text-right font-medium">Faturado (kWh)</th>
                  <th className="px-5 py-3 text-right font-medium">Perda (kWh)</th>
                  <th className="px-5 py-3 text-right font-medium">Perda %</th>
                  <th className="px-5 py-3 text-right font-medium">CVE Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.porSubestacao ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-sm">
                      Sem dados de injeção para o período selecionado
                    </td>
                  </tr>
                ) : (
                  data?.porSubestacao.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700">{r.nome}</td>
                      <td className="px-5 py-3 text-slate-500">{r.ilha}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600">{r.kwh_injetado.toLocaleString("pt-CV")}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600">{r.kwh_faturado.toLocaleString("pt-CV")}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-red-600 font-medium">{r.perda_kwh.toLocaleString("pt-CV")}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.perda_pct > 25
                            ? "bg-red-100 text-red-700"
                            : r.perda_pct > 15
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {r.perda_pct}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatCVE(r.cve_estimado)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
