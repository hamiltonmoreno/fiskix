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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { ClipboardCheck, XCircle, CheckCircle2, Clock } from "lucide-react";
import { useInspecoesData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

export function TabInspecoes({ filtros, active, onExportReady }: Props) {
  const { data, loading } = useInspecoesData(filtros, active);

  useEffect(() => {
    if (!data) return;
    const headers = ["Zona", "Total", "Confirmadas", "Anomalias", "Falsos Positivos", "Pendentes", "Taxa Sucesso (%)"];
    const rows: ExportRow[] = data.porZona.map((r) => ({
      "Zona": r.zona,
      "Total": r.total,
      "Confirmadas": r.confirmadas,
      "Anomalias": r.anomalias,
      "Falsos Positivos": r.falsosPositivos,
      "Pendentes": r.pendentes,
      "Taxa Sucesso (%)": r.taxaSucesso,
    }));
    onExportReady(headers, rows);
  }, [data, onExportReady]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Total Inspeções</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.total ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">no período</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Fraudes Confirmadas</span>
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.confirmadas ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">resultado confirmado em campo</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Falsos Positivos</span>
            <div className="p-2 rounded-lg bg-slate-100 text-muted-foreground">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.falsosPositivos ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">quanto menor, melhor</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">
              {data ? `${data.kpis.taxaSucesso}%` : "—"}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">confirmadas / inspecionadas</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* BarChart by zone */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Resultados por Zona</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.porZona} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="zona" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="confirmadas" name="Confirmadas" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="falsosPositivos" name="Falsos Positivos" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendentes" name="Pendentes" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição de Resultados</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data?.donut.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                >
                  {data?.donut.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => v.toLocaleString("pt-CV")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Detalhe por Zona</h3>
        </div>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Zona</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Confirmadas</th>
                  <th className="px-5 py-3 text-right font-medium">Anomalias</th>
                  <th className="px-5 py-3 text-right font-medium">Falsos Positivos</th>
                  <th className="px-5 py-3 text-right font-medium">Pendentes</th>
                  <th className="px-5 py-3 text-right font-medium">Taxa Sucesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.porZona ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-sm">
                      Sem dados de inspeção para o período selecionado
                    </td>
                  </tr>
                ) : (
                  data?.porZona.map((r) => (
                    <tr key={r.zona} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{r.zona}</td>
                      <td className="px-5 py-3 text-right text-foreground">{r.total}</td>
                      <td className="px-5 py-3 text-right text-green-600 font-medium">{r.confirmadas}</td>
                      <td className="px-5 py-3 text-right text-amber-600">{r.anomalias}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{r.falsosPositivos}</td>
                      <td className="px-5 py-3 text-right text-blue-600">{r.pendentes}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full"
                              style={{ width: `${r.taxaSucesso}%` }}
                            />
                          </div>
                          <span className="text-foreground tabular-nums">{r.taxaSucesso}%</span>
                        </div>
                      </td>
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
