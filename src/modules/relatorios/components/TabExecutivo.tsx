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
  Download,
} from "lucide-react";
import { formatCVE } from "@/lib/utils";
import { useExecutivoData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

const HISTORICO_MOCK = [
  { id: "REL-2026-003", tipo: "Mensal", periodo: "mar. 2026", gerado_em: "01/04/2026", gerado_por: "Admin Fiskix" },
  { id: "REL-2026-002", tipo: "Trimestral", periodo: "Q1 2026", gerado_em: "02/04/2026", gerado_por: "Admin Fiskix" },
  { id: "REL-2026-001", tipo: "Mensal", periodo: "fev. 2026", gerado_em: "03/03/2026", gerado_por: "Admin Fiskix" },
  { id: "REL-2025-012", tipo: "Mensal", periodo: "dez. 2025", gerado_em: "02/01/2026", gerado_por: "Admin Fiskix" },
];

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

      {/* Histórico de relatórios */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Histórico de Relatórios Gerados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">ID</th>
                <th className="px-5 py-3 text-left font-medium">Tipo</th>
                <th className="px-5 py-3 text-left font-medium">Período</th>
                <th className="px-5 py-3 text-left font-medium">Gerado Em</th>
                <th className="px-5 py-3 text-left font-medium">Gerado Por</th>
                <th className="px-5 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {HISTORICO_MOCK.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-foreground">{r.id}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-foreground">{r.periodo}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.gerado_em}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.gerado_por}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors" title="Descarregar">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
