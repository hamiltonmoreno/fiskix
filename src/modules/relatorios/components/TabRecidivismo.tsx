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
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Total Reincidentes</span>
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data?.kpis.totalReincidentes ?? "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">clientes com 2+ fraudes</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Média de Alertas</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data?.kpis.mediaAlertas ?? "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">por reincidente</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Taxa de Reincidência</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">
              {data ? `${data.kpis.taxaReincidencia}%` : "—"}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">do total de clientes alertados</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Máx. Deteções</span>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Star className="w-4 h-4" />
            </div>
          </div>
          {loading ? <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" /> : (
            <div className="text-2xl font-bold text-slate-900">{data?.kpis.maxAlertas ?? "—"}</div>
          )}
          <p className="text-xs text-slate-400 mt-1">pelo mesmo cliente</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly new reincidentes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Novos Reincidentes por Mês</h3>
          {loading ? (
            <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.mensalNovos} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="novos" name="Novos Reincidentes" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 10 horizontal */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top 10 Clientes por Ocorrências</h3>
          {loading ? (
            <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
          ) : (data?.top10 ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
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
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                <Tooltip />
                <Bar dataKey="confirmados" name="Confirmações" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Clientes Reincidentes</h3>
        </div>
        {loading ? (
          <div className="h-40 bg-slate-50 animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
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
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">
                      Nenhum reincidente encontrado no período selecionado
                    </td>
                  </tr>
                ) : (
                  data?.tabela.map((r) => (
                    <tr key={r.id_cliente} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700">{r.nome_titular}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.numero_contador}</td>
                      <td className="px-5 py-3 text-slate-500">{r.zona}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.total_alertas >= 5
                            ? "bg-red-100 text-red-700"
                            : r.total_alertas >= 3
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {r.total_alertas}×
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{r.ultimo_mes}</td>
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
