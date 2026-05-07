"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, User, Zap, TrendingDown, AlertTriangle, Brain, MessageSquare } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { StatusBadge } from "@/components/ui/status-badge";

interface Subestacao { nome: string; zona_bairro: string; ilha: string }
interface Cliente {
  id: string; nome_titular: string; numero_contador: string; morada: string;
  tipo_tarifa: string; telemovel: string | null; lat: number | null; lng: number | null;
  ativo: boolean; subestacoes: Subestacao;
}
interface Faturacao { mes_ano: string; kwh_faturado: number; valor_cve: number }
interface Alerta {
  id: string; mes_ano: string; score_risco: number; status: string;
  resultado: string | null; motivo: Record<string, unknown>[] | null; criado_em: string;
}
interface MlPredicao { mes_ano: string; score_ml: number; modelo_versao: string; features_json: Record<string, number> | null }

interface Props {
  cliente: Cliente;
  faturacao: Faturacao[];
  alertas: Alerta[];
  mlPredicoes: MlPredicao[];
}

const TARIFA_LABELS: Record<string, string> = {
  Residencial: "Residencial", Comercial: "Comercial",
  Industrial: "Industrial", Servicos_Publicos: "Serviços Públicos",
};

const FEATURE_LABELS: Record<string, string> = {
  f_queda: "Queda consumo", f_cv: "Variância", f_zscore: "Desvio cluster",
  f_slope: "Tendência desc.", f_ratio_pico: "Rácio pico", f_alertas_12m: "Reincidência", f_perda_zona: "Zona perda",
};

export function FichaClienteClient({ cliente, faturacao, alertas, mlPredicoes }: Props) {
  const chartData = useMemo(() => {
    return [...faturacao].reverse().map((f) => ({
      mes: f.mes_ano.slice(0, 7),
      kwh: f.kwh_faturado,
      cve: f.valor_cve,
    }));
  }, [faturacao]);

  const mediaKwh = useMemo(() => {
    if (!faturacao.length) return 0;
    return Math.round(faturacao.reduce((s, f) => s + f.kwh_faturado, 0) / faturacao.length);
  }, [faturacao]);

  const ultimoScore = alertas[0]?.score_risco ?? null;
  const ultimoMl = mlPredicoes[0]?.score_ml ?? null;
  const alertasConfirmados = alertas.filter((a) => a.resultado === "Fraude_Confirmada").length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      {/* Voltar */}
      <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar a Clientes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{cliente.nome_titular}</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-mono">{cliente.numero_contador} · {cliente.subestacoes.zona_bairro.replace(/_/g, " ")} · {TARIFA_LABELS[cliente.tipo_tarifa] ?? cliente.tipo_tarifa}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${cliente.ativo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400"}`}>
          {cliente.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Zap} label="Média consumo (kWh)" value={mediaKwh.toLocaleString("pt-CV")} tone="blue" />
        <KpiCard icon={TrendingDown} label="Último score risco" value={ultimoScore !== null ? `${ultimoScore} pts` : "—"} tone={ultimoScore !== null && ultimoScore >= 75 ? "red" : ultimoScore !== null && ultimoScore >= 50 ? "amber" : "slate"} />
        <KpiCard icon={Brain} label="Score ML atual" value={ultimoMl !== null ? `${(ultimoMl * 100).toFixed(0)}%` : "—"} tone="blue" />
        <KpiCard icon={AlertTriangle} label="Fraudes confirmadas" value={alertasConfirmados} tone={alertasConfirmados > 0 ? "red" : "slate"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Gráfico consumo */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Consumo histórico (kWh)</h2>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400 dark:text-gray-500">Sem dados de faturação</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="cgKwh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString("pt-CV")} kWh`, "Consumo"]} labelStyle={{ fontSize: 11 }} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <ReferenceLine y={mediaKwh} stroke="#f59e0b" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="kwh" stroke="#3b82f6" strokeWidth={2} fill="url(#cgKwh)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Info do cliente */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Dados do cliente</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wide">Morada</dt><dd className="text-slate-700 dark:text-gray-200 mt-0.5">{cliente.morada}</dd></div>
            <div><dt className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wide">Subestação</dt><dd className="text-slate-700 dark:text-gray-200 mt-0.5">{cliente.subestacoes.nome}</dd></div>
            <div><dt className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wide">Ilha</dt><dd className="text-slate-700 dark:text-gray-200 mt-0.5">{cliente.subestacoes.ilha.replace(/_/g, " ")}</dd></div>
            <div><dt className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wide">Tarifa</dt><dd className="text-slate-700 dark:text-gray-200 mt-0.5">{TARIFA_LABELS[cliente.tipo_tarifa] ?? cliente.tipo_tarifa}</dd></div>
            {cliente.telemovel && <div><dt className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wide">Telemóvel</dt><dd className="text-slate-700 dark:text-gray-200 mt-0.5 font-mono">{cliente.telemovel}</dd></div>}
            {cliente.lat && cliente.lng && (
              <div>
                <dt className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wide">Coordenadas</dt>
                <dd className="mt-0.5">
                  <a href={`https://maps.google.com/?q=${cliente.lat},${cliente.lng}`} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 font-mono text-xs hover:underline">
                    {cliente.lat.toFixed(5)}, {cliente.lng.toFixed(5)}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* ML features do último mês */}
      {mlPredicoes[0]?.features_json && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">
            Features ML — {mlPredicoes[0].mes_ano} <span className="text-xs font-normal text-slate-400 ml-1">({mlPredicoes[0].modelo_versao})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(mlPredicoes[0].features_json).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-gray-700 mb-1.5 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, val * 100)}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-tight">{FEATURE_LABELS[key] ?? key}</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">{(val * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de SMS */}
      {alertas.some((a) => ["Notificado_SMS", "Pendente_Inspecao", "Inspecionado"].includes(a.status)) && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Notificações SMS enviadas</h2>
          </div>
          <div className="space-y-2">
            {alertas
              .filter((a) => ["Notificado_SMS", "Pendente_Inspecao", "Inspecionado"].includes(a.status))
              .map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-gray-300 font-mono">{a.mes_ano}</span>
                  <span className="text-xs text-slate-500 dark:text-gray-400 flex-1">SMS de alerta enviado · score {a.score_risco} pts</span>
                  <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 rounded-full">Notificado</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Alertas histórico */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/60">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Histórico de alertas</h2>
        </div>
        {alertas.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-gray-500">Sem alertas gerados para este cliente.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Mês</th>
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Resultado</th>
                  <th className="px-4 py-3 text-left font-medium">Regras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                {alertas.map((a) => (
                  <tr key={a.id} className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300 font-mono text-xs">{a.mes_ano}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold text-sm ${a.score_risco >= 75 ? "text-red-600 dark:text-red-400" : a.score_risco >= 50 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-gray-300"}`}>
                        {a.score_risco}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3">{a.resultado ? <StatusBadge status={a.resultado} /> : <span className="text-slate-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">
                      {Array.isArray(a.motivo) && (
                        <div className="flex flex-wrap gap-1">
                          {(a.motivo as Array<{ regra: string }>).map((m) => (
                            <span key={m.regra} className="text-[10px] font-mono bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                              {m.regra}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string | number; tone: "red" | "amber" | "slate" | "blue" }) {
  const palette = {
    red: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  };
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${palette[tone]}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
