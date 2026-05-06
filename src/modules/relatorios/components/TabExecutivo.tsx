"use client";

import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Target,
} from "lucide-react";
import { formatCVE } from "@/lib/utils";
import { useExecutivoData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";


interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

export function TabExecutivo({ filtros, active, onExportReady }: Props) {
  const { data, loading } = useExecutivoData(filtros, active);

  useEffect(() => {
    if (!data) return;
    const headers = ["Mês", "Perda (CVE)", "Recuperado (CVE)", "ROI (CVE)", "ROI Acumulado (CVE)"];
    const rows: ExportRow[] = data.serie.map((r) => ({
      "Mês": r.mes,
      "Perda (CVE)": r.perda,
      "Recuperado (CVE)": r.recuperado,
      "ROI (CVE)": r.roi,
      "ROI Acumulado (CVE)": r.roiAcumulado,
    }));
    onExportReady(headers, rows);
  }, [data, onExportReady]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Total Alertas</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.totalAlertas ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">no período selecionado</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Fraudes Confirmadas</span>
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div className="text-2xl font-bold text-foreground">{data?.kpis.fraudesConfirmadas ?? "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">em campo confirmadas</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Receita Recuperada</span>
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div className="text-2xl font-bold text-foreground">{data ? formatCVE(data.kpis.receitaRecuperada) : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">fraudes confirmadas YTD</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Taxa de Deteção</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <Target className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div className="text-2xl font-bold text-foreground">
              {data ? `${data.kpis.taxaDetecao.toFixed(1)}%` : "—"}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">alertas confirmados / total</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Perdas vs Recuperado */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Perdas vs Receita Recuperada</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data?.serie} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradPerdaExec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRecuperadoExec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCVE(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="perda" name="Perda (CVE)" stroke="#EF4444" fill="url(#gradPerdaExec)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="recuperado" name="Recuperado (CVE)" stroke="#22C55E" fill="url(#gradRecuperadoExec)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ROI Acumulado */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">ROI Acumulado do Sistema</h3>
          <p className="text-xs text-muted-foreground mb-3">Custo plataforma: 500 000 CVE/mês. Break-even = linha vermelha.</p>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data?.serie} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradROIExec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCVE(v)} />
                <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Break-even", position: "insideTopRight", fontSize: 11, fill: "#EF4444" }} />
                <Area type="monotone" dataKey="roiAcumulado" name="ROI Acumulado (CVE)" stroke="#3B82F6" fill="url(#gradROIExec)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  );
}
