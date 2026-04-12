"use client";

import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Zap, TrendingDown, MapPin, AlertTriangle } from "lucide-react";
import { formatCVE, formatKWh } from "@/lib/utils";
import { usePerdasZonaData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

export function TabPerdasZona({ filtros, active, onExportReady }: Props) {
  const { data, loading } = usePerdasZonaData(filtros, active);

  useEffect(() => {
    if (!data) return;
    const headers = ["Subestação", "Ilha", "Injetado (kWh)", "Faturado (kWh)", "Perda (kWh)", "Perda (%)", "CVE Estimado"];
    const rows: ExportRow[] = data.tabela.map((r) => ({
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

  const zonaCritica = data?.tabela.find((r) => r.perda_pct > 25);

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
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data ? formatKWh(data.kpis.totalInjetado) : "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">na rede no período</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Total Faturado</span>
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data ? formatKWh(data.kpis.totalFaturado) : "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">cobrado aos clientes</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Perda Total</span>
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data ? formatKWh(data.kpis.perdaKwh) : "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">{data ? `${data.kpis.perdaPct}% da rede` : ""}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">
              {zonaCritica ? "Zona Mais Crítica" : "% Perda Global"}
            </span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              {zonaCritica ? <MapPin className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">
              {zonaCritica ? zonaCritica.nome : data ? `${data.kpis.perdaPct}%` : "—"}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {zonaCritica ? `${zonaCritica.perda_pct}% de perda` : "média da rede"}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Horizontal BarChart — top 7 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top 7 Subestações — Injetado vs Faturado</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data?.top7}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={100}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                />
                <Tooltip formatter={(v: number) => formatKWh(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="kwh_injetado" name="Injetado" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="kwh_faturado" name="Faturado" fill="#22C55E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* RadarChart by ilha */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Índice de Risco por Ilha (%)</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (data?.radarIlha && data.radarIlha.length > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={data.radarIlha} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="ilha" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Radar
                  name="% Perda"
                  dataKey="indice_risco"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.25}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Sem dados por ilha no período selecionado
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Detalhe por Subestação</h3>
        </div>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Subestação</th>
                  <th className="px-5 py-3 text-left font-medium">Ilha</th>
                  <th className="px-5 py-3 text-right font-medium">Injetado</th>
                  <th className="px-5 py-3 text-right font-medium">Faturado</th>
                  <th className="px-5 py-3 text-right font-medium">Perda kWh</th>
                  <th className="px-5 py-3 text-right font-medium">Perda %</th>
                  <th className="px-5 py-3 text-right font-medium">CVE Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.tabela ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-sm">
                      Sem dados de injeção para o período selecionado
                    </td>
                  </tr>
                ) : (
                  data?.tabela.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700">{r.nome}</td>
                      <td className="px-5 py-3 text-slate-500">{r.ilha}</td>
                      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{r.kwh_injetado.toLocaleString("pt-CV")}</td>
                      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{r.kwh_faturado.toLocaleString("pt-CV")}</td>
                      <td className="px-5 py-3 text-right text-red-600 font-medium tabular-nums">{r.perda_kwh.toLocaleString("pt-CV")}</td>
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
                      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{formatCVE(r.cve_estimado)}</td>
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
