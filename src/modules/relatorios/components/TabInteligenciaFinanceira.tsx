"use client";

import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { DollarSign, AlertTriangle, FileQuestion, TrendingUp } from "lucide-react";
import { formatCVE } from "@/lib/utils";
import { useInteligenciaFinanceiraData } from "../hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

const TIPO_LEITURA_LABELS: Record<string, string> = {
  real: "Real",
  estimada: "Estimada",
  empresa: "Empresa",
  cliente: "Cliente",
  sem_dado: "Sem dado",
};
const TIPO_LEITURA_COLORS: Record<string, string> = {
  real: "#10B981",
  empresa: "#3B82F6",
  cliente: "#8B5CF6",
  estimada: "#EF4444",
  sem_dado: "#94A3B8",
};

export function TabInteligenciaFinanceira({ filtros, active, onExportReady }: Props) {
  const { data, loading } = useInteligenciaFinanceiraData(filtros, active);

  useEffect(() => {
    if (!data) return;
    const headers = ["Nº Contador", "Titular", "Zona", "Dívida (CVE)", "Score Risco"];
    const rows: ExportRow[] = data.topDevedores.map((d) => ({
      "Nº Contador": d.numero_contador,
      "Titular": d.nome_titular,
      "Zona": d.zona_bairro,
      "Dívida (CVE)": d.saldo_atual_cve,
      "Score Risco": d.score_risco,
    }));
    onExportReady(headers, rows);
  }, [data, onExportReady]);

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-700">
        <strong>R10 — Dívida Acumulada:</strong> clientes com saldo ≥ <strong>{data ? formatCVE(data.kpis.limiar_divida_cve) : "3.000 CVE"}</strong> têm
        incentivo financeiro directo para fraudar. Limiar configurável em <strong>Admin → Configuração</strong>.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Dívida Total" value={data ? formatCVE(data.kpis.divida_total_cve) : "—"} hint="saldo acumulado no mês"
          icon={<DollarSign className="w-4 h-4" />} colorBg="bg-red-100" colorFg="text-red-600" loading={loading} accent="text-red-700" />
        <KpiCard label="Clientes em Dívida" value={data ? `${data.kpis.clientes_em_divida}` : "—"} hint="≥ limiar R10"
          icon={<AlertTriangle className="w-4 h-4" />} colorBg="bg-amber-100" colorFg="text-amber-600" loading={loading} />
        <KpiCard label="Leituras Estimadas" value={data ? `${data.kpis.pct_leituras_estimadas}%` : "—"} hint="potencial recusa de acesso"
          icon={<FileQuestion className="w-4 h-4" />} colorBg="bg-orange-100" colorFg="text-orange-600" loading={loading} accent={data && data.kpis.pct_leituras_estimadas > 30 ? "text-orange-700" : undefined} />
        <KpiCard label="Top Devedor" value={data && data.topDevedores[0] ? formatCVE(data.topDevedores[0].saldo_atual_cve) : "—"} hint={data?.topDevedores[0]?.nome_titular ?? ""}
          icon={<TrendingUp className="w-4 h-4" />} colorBg="bg-rose-100" colorFg="text-rose-600" loading={loading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Dívida Acumulada por Subestação</h3>
          {loading ? <Skeleton className="h-64 rounded-lg" /> : (data?.porSubestacao ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Sem dados de dívida no período</div>
          ) : (
            <div className="h-44 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.porSubestacao.slice(0, 10)} margin={{ top: 5, right: 10, left: -10, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="nome" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} tickLine={false} angle={-30} textAnchor="end" interval={0} height={55} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCVE(v)} />
                <Bar dataKey="divida_total_cve" name="Dívida (CVE)" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição Tipo de Leitura</h3>
          {loading ? <Skeleton className="h-64 rounded-lg" /> : (data?.distribuicaoTipoLeitura ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Sem leituras no período</div>
          ) : (
            <div className="h-44 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.distribuicaoTipoLeitura} dataKey="count" nameKey="tipo" cx="50%" cy="50%" outerRadius={90}
                  label={(e: { tipo: string; pct: number }) => `${TIPO_LEITURA_LABELS[e.tipo] ?? e.tipo} ${e.pct.toFixed(0)}%`}>
                  {(data?.distribuicaoTipoLeitura ?? []).map((entry, i) => (
                    <Cell key={i} fill={TIPO_LEITURA_COLORS[entry.tipo] ?? "#94A3B8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} leituras`} />
                <Legend formatter={(v: string) => TIPO_LEITURA_LABELS[v] ?? v} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Top 10 Devedores</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Clientes com maior saldo acumulado — correlação com score de risco do motor</p>
        </div>
        {loading ? <Skeleton className="h-40" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Nº Contador</th>
                  <th className="px-5 py-3 text-left font-medium">Titular</th>
                  <th className="px-5 py-3 text-left font-medium">Zona</th>
                  <th className="px-5 py-3 text-right font-medium">Dívida</th>
                  <th className="px-5 py-3 text-right font-medium">Score Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.topDevedores ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">Sem devedores no período</td></tr>
                ) : (
                  data?.topDevedores.map((d) => (
                    <tr key={d.id_cliente} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-foreground">{d.numero_contador}</td>
                      <td className="px-5 py-3 text-foreground">{d.nome_titular}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{d.zona_bairro}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-red-600 font-medium">{formatCVE(d.saldo_atual_cve)}</td>
                      <td className="px-5 py-3 text-right">
                        {d.score_risco > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            d.score_risco >= 75 ? "bg-red-100 text-red-700"
                            : d.score_risco >= 50 ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-foreground"
                          }`}>{d.score_risco}</span>
                        ) : <span className="text-slate-300 text-xs">sem alerta</span>}
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

interface KpiCardProps {
  label: string; value: string; hint: string;
  icon: React.ReactNode; colorBg: string; colorFg: string;
  loading: boolean; accent?: string;
}
function KpiCard({ label, value, hint, icon, colorBg, colorFg, loading, accent }: KpiCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-lg ${colorBg} ${colorFg}`}>{icon}</div>
      </div>
      {loading ? <Skeleton className="h-8 w-3/4" /> : (
        <div className={`text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</div>
      )}
      <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>
    </div>
  );
}
