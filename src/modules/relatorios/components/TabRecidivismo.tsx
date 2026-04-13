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
  ResponsiveContainer,
} from "recharts";
import { RefreshCw, Users, TrendingUp, Star } from "lucide-react";
import { useRecidivismoData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

export function TabRecidivismo({ filtros, active, onExportReady }: Props) {
  const { data, loading } = useRecidivismoData(filtros, active);

  useEffect(() => {
    if (!data) return;
    const headers = ["Nome Titular", "N.º Contador", "Tipo Tarifa", "Zona", "Total Alertas", "Confirmados", "Último Mês"];
    const rows: ExportRow[] = data.tabela.map((r) => ({
      "Nome Titular": r.nome_titular,
      "N.º Contador": r.numero_contador,
      "Tipo Tarifa": r.tipo_tarifa,
      "Zona": r.zona,
      "Total Alertas": r.total_alertas,
      "Confirmados": r.confirmados,
      "Último Mês": r.ultimo_mes,
    }));
    onExportReady(headers, rows);
  }, [data, onExportReady]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Total Reincidentes</span>
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.totalReincidentes ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">clientes com 2+ fraudes</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Média de Alertas</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.mediaAlertas ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">por reincidente</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Taxa de Reincidência</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">
              {data ? `${data.kpis.taxaReincidencia}%` : "—"}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">do total de clientes alertados</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Máx. Deteções</span>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Star className="w-4 h-4" />
            </div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.maxAlertas ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">pelo mesmo cliente</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly new reincidentes */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Novos Reincidentes por Mês</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.mensalNovos} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="novos" name="Novos Reincidentes" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 10 horizontal */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 10 Clientes por Ocorrências</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (data?.top10 ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Sem reincidentes no período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data?.top10.map((r) => ({
                  nome: r.nome_titular.split(" ").slice(0, 2).join(" "),
                  confirmados: r.confirmados,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                <Tooltip />
                <Bar dataKey="confirmados" name="Confirmações" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Clientes Reincidentes</h3>
        </div>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Nome Titular</th>
                  <th className="px-5 py-3 text-left font-medium">N.º Contador</th>
                  <th className="px-5 py-3 text-left font-medium">Zona</th>
                  <th className="px-5 py-3 text-right font-medium">Deteções</th>
                  <th className="px-5 py-3 text-left font-medium">Último Mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.tabela ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">
                      Nenhum reincidente encontrado no período selecionado
                    </td>
                  </tr>
                ) : (
                  data?.tabela.map((r) => (
                    <tr key={r.id_cliente} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{r.nome_titular}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.numero_contador}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.zona}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.total_alertas >= 5
                            ? "bg-red-100 text-red-700"
                            : r.total_alertas >= 3
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-foreground"
                        }`}>
                          {r.total_alertas}×
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{r.ultimo_mes}</td>
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
