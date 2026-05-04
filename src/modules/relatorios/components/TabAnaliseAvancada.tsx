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
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown, ShieldAlert, Wrench, DollarSign } from "lucide-react";
import { formatKWh, formatCVE } from "@/lib/utils";
import { useAnaliseAvancadaData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

export function TabAnaliseAvancada({ filtros, active, onExportReady }: Props) {
  const { data, loading } = useAnaliseAvancadaData(filtros, active);

  useEffect(() => {
    if (!data) return;
    const headers = [
      "Subestação", "Zona", "Perda Total (kWh)", "Perda Técnica (kWh)",
      "Perda Comercial (kWh)", "Perda Comercial (%)", "CVE Comercial Estimado",
      "Índice Recuperabilidade", "Alertas Score Alto", "Total Alertas",
    ];
    const rows: ExportRow[] = data.porSubestacao.map((r) => ({
      "Subestação": r.nome,
      "Zona": r.zona_bairro,
      "Perda Total (kWh)": r.perda_kwh,
      "Perda Técnica (kWh)": r.perda_tecnica_kwh,
      "Perda Comercial (kWh)": r.perda_comercial_kwh,
      "Perda Comercial (%)": r.perda_comercial_pct,
      "CVE Comercial Estimado": r.cve_comercial_estimado,
      "Índice Recuperabilidade": r.irec,
      "Alertas Score Alto": r.alertas_alto_score,
      "Total Alertas": r.total_alertas,
    }));
    onExportReady(headers, rows);
  }, [data, onExportReady]);

  return (
    <div className="space-y-6">
      {/* Contexto informativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-700">
        Perdas técnicas estimadas: <strong>{data?.kpis.perda_tecnica_estimada_pct ?? 5}%</strong> da energia injetada
        (benchmark de rede de distribuição). O excedente é classificado como perda comercial (fraude ou erro de medição).
        Configurável em <strong>Admin → Configuração</strong>.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Perda Comercial</span>
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><ShieldAlert className="w-4 h-4" /></div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-red-700">{data ? formatKWh(data.kpis.perda_comercial_kwh) : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">fraude + erros de medição</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Perda Técnica</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Wrench className="w-4 h-4" /></div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data ? formatKWh(data.kpis.perda_tecnica_kwh) : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">resistência de cabos e transformadores</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">% Comercial/Total</span>
            <div className="p-2 rounded-lg bg-rose-100 text-rose-600"><TrendingDown className="w-4 h-4" /></div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-rose-700">{data ? `${data.kpis.perda_comercial_pct}%` : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">das perdas são de origem comercial</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">CVE Comercial</span>
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><DollarSign className="w-4 h-4" /></div>
          </div>
          {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold text-foreground">{data ? formatCVE(data.kpis.cve_comercial_estimado) : "—"}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">potencial de recuperação</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Técnica vs Comercial por subestação */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Perdas Técnicas vs Comerciais por Subestação</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (data?.porSubestacao ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Sem dados para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.porSubestacao.slice(0, 10)} margin={{ top: 5, right: 10, left: -10, bottom: 35 }}>
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
                <Bar dataKey="perda_tecnica_kwh" name="Técnica" fill="#F59E0B" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="perda_comercial_kwh" name="Comercial" fill="#EF4444" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Evolução mensal técnica vs comercial */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Evolução Mensal — % Perda por Tipo</h3>
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data?.evolucaoComercial} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="pct_tecnica" name="Técnica %" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={2} />
                <Area type="monotone" dataKey="pct_comercial" name="Comercial %" stroke="#EF4444" fill="#FEE2E2" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela com índice de recuperabilidade */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Eficiência Comercial por Subestação</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Índice Recup. = (alertas críticos / total) × % perda — quanto maior, maior o potencial de recuperação</p>
        </div>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Subestação</th>
                  <th className="px-5 py-3 text-left font-medium">Zona</th>
                  <th className="px-5 py-3 text-right font-medium">Perda Técnica</th>
                  <th className="px-5 py-3 text-right font-medium">Perda Comercial</th>
                  <th className="px-5 py-3 text-right font-medium">CVE Comercial</th>
                  <th className="px-5 py-3 text-right font-medium">Alertas Críticos</th>
                  <th className="px-5 py-3 text-right font-medium">Índice Recup.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.porSubestacao ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-sm">
                      Sem dados para o período selecionado
                    </td>
                  </tr>
                ) : (
                  data?.porSubestacao.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{r.nome}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{r.zona_bairro}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-600">{formatKWh(r.perda_tecnica_kwh)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-red-600 font-medium">{formatKWh(r.perda_comercial_kwh)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{formatCVE(r.cve_comercial_estimado)}</td>
                      <td className="px-5 py-3 text-right">
                        {r.total_alertas > 0 ? (
                          <span className="text-foreground">
                            {r.alertas_alto_score}/{r.total_alertas}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.irec > 10 ? "bg-red-100 text-red-700"
                          : r.irec > 5 ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-foreground"
                        }`}>
                          {r.irec}
                        </span>
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
