"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Download,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { formatCVE, formatKWh, formatMesAno, getCurrentMesAno } from "@/lib/utils";
import {
  fetchDrillDown,
  useBalanco,
  type BalancoFiltros,
  type DrillDownData,
} from "@/modules/balanco/hooks/useBalanco";
import type { SubestacaoBalancoRow } from "@/modules/balanco/lib/balanco";

interface Profile {
  role: string;
  nome_completo: string;
  id_zona: string | null;
}

const ZONAS = [
  "Achada Santo António",
  "Achada Grande",
  "Várzea",
  "Palmarejo",
  "Plateau",
  "Tira Chapéu",
  "Terra Branca",
];

const TARIFAS: Array<{ value: string; label: string }> = [
  { value: "Residencial", label: "Residencial" },
  { value: "Comercial", label: "Comercial" },
  { value: "Industrial", label: "Industrial" },
  { value: "Servicos_Publicos", label: "Serviços Públicos" },
];

export function BalancoClient({ profile }: { profile: Profile }) {
  const [mesAno, setMesAno] = useState(getCurrentMesAno());
  const [zona, setZona] = useState<string | undefined>(profile.id_zona ?? undefined);
  const [tipoTarifa, setTipoTarifa] = useState<string | undefined>(undefined);
  const [drillId, setDrillId] = useState<string | null>(null);

  const filtros: BalancoFiltros = useMemo(
    () => ({ mesAno, zona, tipoTarifa, nMeses: 12 }),
    [mesAno, zona, tipoTarifa],
  );

  const { data, loading } = useBalanco(filtros);

  const drillSub = data?.porSubestacao.find((s) => s.id === drillId) ?? null;

  function handleExport() {
    if (!data) return;
    const headers = [
      "Subestação",
      "Ilha",
      "Zona",
      "Injetado (kWh)",
      "Faturado (kWh)",
      "Perda (kWh)",
      "Perda (%)",
      "Perda Técnica (kWh)",
      "Perda Comercial (kWh)",
      "CVE Estimado",
      "Classificação",
    ];
    const rows = data.porSubestacao.map((r) => ({
      "Subestação": r.nome,
      "Ilha": r.ilha,
      "Zona": r.zona_bairro,
      "Injetado (kWh)": r.kwh_injetado,
      "Faturado (kWh)": r.kwh_faturado,
      "Perda (kWh)": r.perda_kwh,
      "Perda (%)": r.perda_pct,
      "Perda Técnica (kWh)": r.perda_tecnica_kwh,
      "Perda Comercial (kWh)": r.perda_comercial_kwh,
      "CVE Estimado": r.cve_estimado,
      "Classificação": r.classificacao,
    }));
    exportToExcel(`balanco_energetico_${mesAno}`, headers, rows);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="font-bold text-slate-900">Balanço Energético</h1>
            <p className="text-sm text-slate-400">
              Energia injetada vs faturada por subestação · perdas técnicas e comerciais
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!data || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
                Mês / Ano
              </label>
              <input
                type="month"
                value={mesAno}
                onChange={(e) => setMesAno(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
                Zona
              </label>
              <select
                value={zona ?? ""}
                onChange={(e) => setZona(e.target.value || undefined)}
                disabled={!!profile.id_zona}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              >
                <option value="">Todas as zonas</option>
                {ZONAS.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
                Tipo de Tarifa
              </label>
              <select
                value={tipoTarifa ?? ""}
                onChange={(e) => setTipoTarifa(e.target.value || undefined)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as tarifas</option>
                {TARIFAS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Injetado"
            value={data ? formatKWh(data.kpis.totalInjetado) : "—"}
            subtitle="energia fornecida"
            icon={Zap}
            color="blue"
            loading={loading}
          />
          <KpiCard
            label="Faturado"
            value={data ? formatKWh(data.kpis.totalFaturado) : "—"}
            subtitle="energia cobrada"
            icon={Zap}
            color="green"
            loading={loading}
          />
          <KpiCard
            label="Perda Total"
            value={data ? formatKWh(data.kpis.perdaKwh) : "—"}
            subtitle={data ? formatCVE(data.kpis.cveEstimado) : ""}
            icon={TrendingDown}
            color="red"
            loading={loading}
          />
          <KpiCard
            label="% Perda"
            value={data ? `${data.kpis.perdaPct}%` : "—"}
            subtitle={
              data?.yoy
                ? `${data.yoy.deltaPct >= 0 ? "+" : ""}${data.yoy.deltaPct} pp vs ano anterior`
                : "—"
            }
            icon={data?.yoy && data.yoy.deltaPct < 0 ? TrendingDown : TrendingUp}
            color={(data?.kpis.perdaPct ?? 0) > 15 ? "red" : "amber"}
            loading={loading}
            highlight={(data?.kpis.perdaPct ?? 0) > 15}
          />
          <KpiCard
            label="Subestações Críticas"
            value={data ? `${data.kpis.subestacoesCriticas}` : "—"}
            subtitle="≥ 25% perda"
            icon={AlertTriangle}
            color={(data?.kpis.subestacoesCriticas ?? 0) > 0 ? "red" : "slate"}
            loading={loading}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Tendência de perda */}
          <ChartCard title="Evolução da % de Perda (12 meses)" loading={loading}>
            {data && data.evolucao.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.evolucao} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="perdaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="mes_ano"
                    tickFormatter={(v) => v.split("-")[1]}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v: number) => `${v.toFixed(2)}%`}
                    labelFormatter={(l) => formatMesAno(l as string)}
                  />
                  <Area
                    type="monotone"
                    dataKey="perda_pct"
                    stroke="#EF4444"
                    strokeWidth={2}
                    fill="url(#perdaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Injetado vs Faturado por subestacao */}
          <ChartCard title="Injetado vs Faturado por Subestação (Top 10)" loading={loading}>
            {data && data.porSubestacao.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.porSubestacao.slice(0, 10)}
                  margin={{ top: 5, right: 10, left: -10, bottom: 30 }}
                >
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
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(v: number) => formatKWh(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="kwh_injetado" name="Injetado" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="kwh_faturado" name="Faturado" fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </ChartCard>
        </div>

        {/* Split técnica vs comercial */}
        <ChartCard title="Perdas Técnicas vs Comerciais por Subestação (Top 10)" loading={loading}>
          {data && data.porSubestacao.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.porSubestacao.slice(0, 10)}
                margin={{ top: 5, right: 10, left: -10, bottom: 30 }}
              >
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
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v: number) => formatKWh(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="perda_tecnica_kwh" name="Perda técnica" stackId="p" fill="#94A3B8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="perda_comercial_kwh" name="Perda comercial" stackId="p" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Balanço por Subestação</h3>
              <p className="text-xs text-slate-400 mt-0.5">Clique numa linha para ver detalhes</p>
            </div>
            <span className="text-xs text-slate-400">
              {data?.porSubestacao.length ?? 0} subestações
            </span>
          </div>
          {loading ? (
            <div className="h-40 bg-slate-50 animate-pulse" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
                    <th className="px-5 py-3 text-left font-medium">Subestação</th>
                    <th className="px-5 py-3 text-left font-medium">Zona</th>
                    <th className="px-5 py-3 text-right font-medium">Injetado</th>
                    <th className="px-5 py-3 text-right font-medium">Faturado</th>
                    <th className="px-5 py-3 text-right font-medium">Perda kWh</th>
                    <th className="px-5 py-3 text-right font-medium">Perda %</th>
                    <th className="px-5 py-3 text-right font-medium">Comercial</th>
                    <th className="px-5 py-3 text-right font-medium">CVE</th>
                    <th className="px-5 py-3 text-center font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(data?.porSubestacao ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-slate-400 text-sm">
                        Sem dados de injeção para o período/filtros selecionados
                      </td>
                    </tr>
                  ) : (
                    data?.porSubestacao.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setDrillId(r.id)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3 font-medium text-slate-700">{r.nome}</td>
                        <td className="px-5 py-3 text-slate-500">{r.zona_bairro}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                          {r.kwh_injetado.toLocaleString("pt-CV")}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                          {r.kwh_faturado.toLocaleString("pt-CV")}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-red-600 font-medium">
                          {r.perda_kwh.toLocaleString("pt-CV")}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.classificacao === "critico"
                                ? "bg-red-100 text-red-700"
                                : r.classificacao === "atencao"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {r.perda_pct}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                          {r.perda_comercial_kwh.toLocaleString("pt-CV")}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                          {formatCVE(r.cve_estimado)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <ClassificacaoBadge value={r.classificacao} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <DrillDownModal
        open={!!drillId}
        onClose={() => setDrillId(null)}
        sub={drillSub}
        mesAno={mesAno}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  loading,
  highlight,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: "blue" | "green" | "red" | "amber" | "slate";
  loading: boolean;
  highlight?: boolean;
}) {
  const palette: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    slate: "bg-slate-100 text-slate-500",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`p-2 rounded-lg ${palette[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" />
      ) : (
        <div className={`text-2xl font-bold ${highlight ? "text-red-700" : "text-slate-900"}`}>
          {value}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>
    </div>
  );
}

function ChartCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {loading ? <div className="h-64 bg-slate-100 animate-pulse rounded-lg" /> : children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
      Sem dados para o período selecionado
    </div>
  );
}

function ClassificacaoBadge({ value }: { value: SubestacaoBalancoRow["classificacao"] }) {
  const map = {
    ok: { label: "OK", cls: "bg-green-100 text-green-700" },
    atencao: { label: "Atenção", cls: "bg-amber-100 text-amber-700" },
    critico: { label: "Crítico", cls: "bg-red-100 text-red-700" },
  } as const;
  const { label, cls } = map[value];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ── Drill-down modal ────────────────────────────────────────────────────────────

function DrillDownModal({
  open,
  onClose,
  sub,
  mesAno,
}: {
  open: boolean;
  onClose: () => void;
  sub: SubestacaoBalancoRow | null;
  mesAno: string;
}) {
  const [data, setData] = useState<DrillDownData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !sub) {
      setData(null);
      return;
    }
    setLoading(true);
    fetchDrillDown(sub.id, mesAno)
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [open, sub, mesAno]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
          <Dialog.Title className="sr-only">Detalhe da subestação</Dialog.Title>
          <div className="flex items-start justify-between p-5 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900">{sub?.nome ?? "—"}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {sub?.zona_bairro} · {sub?.ilha} · {formatMesAno(mesAno)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Mini KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniKPI label="Injetado" value={sub ? formatKWh(sub.kwh_injetado) : "—"} />
              <MiniKPI label="Faturado" value={sub ? formatKWh(sub.kwh_faturado) : "—"} />
              <MiniKPI
                label="Perda"
                value={sub ? `${sub.perda_pct}%` : "—"}
                tone={sub?.classificacao === "critico" ? "red" : sub?.classificacao === "atencao" ? "amber" : "default"}
              />
              <MiniKPI
                label="CVE estimado"
                value={sub ? formatCVE(sub.cve_estimado) : "—"}
                tone="red"
              />
            </div>

            {/* Evolução mensal */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Evolução mensal (últimos 6 meses)
              </h4>
              {loading ? (
                <div className="h-48 bg-slate-100 animate-pulse rounded-lg" />
              ) : data && data.evolucao.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.evolucao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="mes_ano"
                      tickFormatter={(v) => v.split("-")[1]}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v: number) => `${v.toFixed(2)}%`}
                      labelFormatter={(l) => formatMesAno(l as string)}
                    />
                    <Line
                      type="monotone"
                      dataKey="perda_pct"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#EF4444" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">Sem histórico</p>
              )}
            </div>

            {/* Top contribuidores */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Top 10 clientes (consumo faturado neste mês)
                </h4>
                <Activity className="w-3.5 h-3.5 text-slate-400" />
              </div>
              {loading ? (
                <div className="h-32 bg-slate-100 animate-pulse rounded-lg" />
              ) : data && data.contribuidores.length > 0 ? (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-xs text-slate-500">
                        <th className="px-3 py-2 text-left font-medium">Cliente</th>
                        <th className="px-3 py-2 text-left font-medium">Contador</th>
                        <th className="px-3 py-2 text-right font-medium">kWh faturado</th>
                        <th className="px-3 py-2 text-right font-medium">% Injetado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.contribuidores.map((c) => (
                        <tr key={c.id_cliente}>
                          <td className="px-3 py-2 text-slate-700">{c.nome_titular}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs tabular-nums">{c.numero_contador}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {c.kwh_faturado.toLocaleString("pt-CV")}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500">{c.share_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">Sem clientes faturados</p>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MiniKPI({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "red" | "amber";
}) {
  const colors = {
    default: "text-slate-900",
    red: "text-red-700",
    amber: "text-amber-700",
  } as const;
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-base font-bold ${colors[tone]} truncate`}>{value}</p>
    </div>
  );
}
