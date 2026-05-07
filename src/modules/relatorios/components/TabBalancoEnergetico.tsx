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
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { Zap, TrendingDown, AlertTriangle } from "lucide-react";
import { formatKWh, formatCVE } from "@/lib/utils";
import { useBalancoEnergeticoData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";
import { DEFAULT_PRICE_CVE_PER_KWH } from "@/modules/balanco/lib/balanco";

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
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Total Injetado</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data ? formatKWh(data.kpis.totalInjetado) : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">energia fornecida à rede</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Total Faturado</span>
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data ? formatKWh(data.kpis.totalFaturado) : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">cobrado aos clientes</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">kWh Perdidos</span>
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data ? formatKWh(data.kpis.perdaKwh) : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">{data ? `≈ ${formatCVE(data.kpis.perdaKwh * DEFAULT_PRICE_CVE_PER_KWH)}` : ""}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">% Perda Global</span>
            <div className={`p-2 rounded-lg ${(data?.kpis.perdaPct ?? 0) > 15 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className={`text-2xl font-bold ${(data?.kpis.perdaPct ?? 0) > 15 ? "text-red-700" : "text-foreground"}`}>
              {data ? `${data.kpis.perdaPct}%` : "—"}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">da rede no período</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* BarChart by subestacao */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Injetado vs Faturado por Subestação</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (data?.porSubestacao ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Sem dados para o período selecionado
            </div>
          ) : (
            <div className="h-44 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.porSubestacao} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={55}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatKWh(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="kwh_injetado" name="Injetado" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="kwh_faturado" name="Faturado" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* LineChart evolução perda % */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Evolução da % de Perda Global</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <div className="h-44 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.evolucaoPerda} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
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
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Balanço por Subestação</h3>
        </div>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
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
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-sm">
                      Sem dados de injeção para o período selecionado
                    </td>
                  </tr>
                ) : (
                  data?.porSubestacao.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{r.nome}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.ilha}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{r.kwh_injetado.toLocaleString("pt-CV")}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{r.kwh_faturado.toLocaleString("pt-CV")}</td>
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
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{formatCVE(r.cve_estimado)}</td>
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
