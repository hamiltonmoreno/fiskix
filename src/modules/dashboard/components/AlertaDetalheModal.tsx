"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  X,
  User,
  MapPin,
  Phone,
  Zap,
  MessageSquare,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCVE, formatKWh, formatMesAno, getLastNMonths, getScoreColor, getScoreLabel } from "@/lib/utils";
import type { AlertaTabela } from "../types";

interface ConsumoMes {
  mes: string;
  kwh: number;
  cve: number;
}

const STATUS_LABELS: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  Pendente: { label: "Pendente", class: "bg-slate-100 text-slate-700", icon: Clock },
  Notificado_SMS: { label: "SMS Enviado", class: "bg-blue-100 text-blue-700", icon: MessageSquare },
  Pendente_Inspecao: { label: "Em Inspeção", class: "bg-amber-100 text-amber-700", icon: ClipboardList },
  Inspecionado: { label: "Inspecionado", class: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const RESULTADO_LABELS: Record<string, { label: string; class: string }> = {
  Fraude_Confirmada: { label: "Fraude Confirmada", class: "bg-red-100 text-red-700" },
  Anomalia_Tecnica: { label: "Anomalia Técnica", class: "bg-amber-100 text-amber-700" },
  Falso_Positivo: { label: "Falso Positivo", class: "bg-slate-100 text-slate-600" },
};

const REGRA_DESC: Record<string, string> = {
  R1: "Queda súbita de consumo vs média 6 meses",
  R2: "Consumo suspeitosamente constante (CV baixo)",
  R3: "Desvio face ao cluster da mesma tarifa",
  R4: "Divergência sazonal cliente vs subestação",
  R5: "Slow bleed: tendência descendente 3+ meses",
  R6: "Rácio CVE/kWh anómalo",
  R7: "Reincidência (alertas confirmados 12 meses)",
  R8: "Consumo atual < 20% do pico histórico",
  R9: "Multiplicador zona vermelha (perda > 15%)",
};

const REGRA_MAX: Record<string, number> = {
  R1: 25, R2: 15, R3: 20, R4: 15, R5: 10, R6: 5, R7: 5, R8: 5, R9: 0,
};

interface Props {
  alerta: AlertaTabela | null;
  open: boolean;
  onClose: () => void;
  onAction: () => void; // reload after SMS/Ordem
}

export function AlertaDetalheModal({ alerta, open, onClose, onAction }: Props) {
  const [consumo, setConsumo] = useState<ConsumoMes[]>([]);
  const [loadingConsumo, setLoadingConsumo] = useState(false);
  const [actionLoading, setActionLoading] = useState<"sms" | "ordem" | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!alerta || !open) return;
    setConsumo([]);
    setActionMsg(null);
    loadConsumo(alerta.id_cliente);
  }, [alerta?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadConsumo(idCliente: string) {
    setLoadingConsumo(true);
    const meses = getLastNMonths(12);
    const { data } = await supabase
      .from("faturacao_clientes")
      .select("mes_ano, kwh_faturado, valor_cve")
      .eq("id_cliente", idCliente)
      .in("mes_ano", meses)
      .order("mes_ano", { ascending: true });

    const byMes = Object.fromEntries((data ?? []).map((r) => [r.mes_ano, { kwh: r.kwh_faturado, cve: r.valor_cve }]));
    setConsumo(
      meses.map((m) => ({
        mes: formatMesAno(m).slice(0, 5), // "jan. " → trimmed
        kwh: byMes[m]?.kwh ?? 0,
        cve: byMes[m]?.cve ?? 0,
      }))
    );
    setLoadingConsumo(false);
  }

  async function handleEnviarSMS() {
    if (!alerta) return;
    setActionLoading("sms");
    setActionMsg(null);
    const tipo = alerta.score_risco >= 75 ? "vermelho" : "amarelo";
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ alerta_id: alerta.id, tipo }),
      }
    );
    const json = await res.json();
    if (json.mensagem_enviada) {
      setActionMsg({ type: "success", text: "SMS enviado com sucesso." });
      onAction();
    } else {
      setActionMsg({ type: "error", text: `Erro: ${json.erro ?? "Desconhecido"}` });
    }
    setActionLoading(null);
  }

  async function handleGerarOrdem() {
    if (!alerta) return;
    setActionLoading("ordem");
    setActionMsg(null);
    const { error } = await supabase
      .from("alertas_fraude")
      .update({ status: "Pendente_Inspecao" })
      .eq("id", alerta.id);
    if (!error) {
      setActionMsg({ type: "success", text: "Ordem de inspeção gerada." });
      onAction();
    } else {
      setActionMsg({ type: "error", text: "Erro ao gerar ordem." });
    }
    setActionLoading(null);
  }

  if (!alerta) return null;

  const scoreClass = getScoreColor(alerta.score_risco);
  const scoreLabel = getScoreLabel(alerta.score_risco);
  const statusInfo = STATUS_LABELS[alerta.status] ?? STATUS_LABELS.Pendente;
  const StatusIcon = statusInfo.icon;
  const regrasPontuadas = alerta.motivo.filter((r) => r.pontos > 0).sort((a, b) => b.pontos - a.pontos);
  const podeEnviarSMS = alerta.status === "Pendente" && !!alerta.cliente.telemovel;
  const podeGerarOrdem = alerta.status === "Pendente" || alerta.status === "Notificado_SMS";
  const totalPoints = regrasPontuadas.reduce((s, r) => s + r.pontos, 0);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50 focus:outline-none">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-bold border ${scoreClass}`}>
                {alerta.score_risco} — {scoreLabel}
              </span>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.class}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusInfo.label}
              </span>
              {alerta.resultado && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${RESULTADO_LABELS[alerta.resultado]?.class ?? ""}`}>
                  {RESULTADO_LABELS[alerta.resultado]?.label ?? alerta.resultado}
                </span>
              )}
            </div>
            <Dialog.Close className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-5">
            {/* Client info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</h3>
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{alerta.cliente.nome_titular}</p>
                    <p className="text-xs text-slate-500 font-mono">{alerta.cliente.numero_contador}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-600">{alerta.cliente.tipo_tarifa}</span>
                </div>
                {alerta.cliente.telemovel && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{alerta.cliente.telemovel}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-600">{alerta.cliente.morada}</p>
                    <p className="text-xs text-slate-400">{alerta.subestacao.zona_bairro} · {alerta.subestacao.nome}</p>
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Decomposição do Score · {alerta.mes_ano}
                </h3>
                {regrasPontuadas.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma regra ativa</p>
                ) : (
                  <div className="space-y-2">
                    {regrasPontuadas.map((r) => {
                      const max = REGRA_MAX[r.regra] || r.pontos || 1;
                      const pct = Math.min(100, (r.pontos / max) * 100);
                      return (
                        <div key={r.regra}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-mono font-semibold text-slate-700">{r.regra}</span>
                            <span className="font-semibold text-slate-700">{r.pontos} pts</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${r.pontos >= max * 0.7 ? "bg-red-500" : "bg-amber-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {r.descricao || REGRA_DESC[r.regra] || ""}
                          </p>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-700">
                      <span>Total (antes de R9)</span>
                      <span>{totalPoints} pts</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Consumption chart */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Consumo Faturado — Últimos 12 Meses
              </h3>
              {loadingConsumo ? (
                <div className="h-40 bg-slate-100 animate-pulse rounded-lg" />
              ) : consumo.every((c) => c.kwh === 0) ? (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                  Sem histórico de consumo disponível
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={consumo} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === "kwh" ? formatKWh(v) : formatCVE(v)
                      }
                    />
                    <Bar
                      dataKey="kwh"
                      name="kWh Faturado"
                      fill="#3B82F6"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {!loadingConsumo && consumo.some((c) => c.kwh > 0) && (
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>Mês atual: <strong className="text-slate-700">{formatKWh(consumo[consumo.length - 1]?.kwh ?? 0)}</strong></span>
                  <span>Média 12m: <strong className="text-slate-700">{formatKWh(consumo.reduce((s, c) => s + c.kwh, 0) / Math.max(1, consumo.filter((c) => c.kwh > 0).length))}</strong></span>
                  <span>CVE: <strong className="text-slate-700">{formatCVE(consumo[consumo.length - 1]?.cve ?? 0)}</strong></span>
                </div>
              )}
            </div>

            {/* Feedback */}
            {actionMsg && (
              <div className={`p-3 rounded-lg text-sm border ${
                actionMsg.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {actionMsg.text}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Alerta <span className="font-mono">{alerta.id.slice(0, 8)}…</span> · {formatMesAno(alerta.mes_ano)}
              </p>
              <div className="flex gap-2">
                {podeEnviarSMS && (
                  <button
                    onClick={handleEnviarSMS}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {actionLoading === "sms" ? "A enviar…" : "Enviar SMS"}
                  </button>
                )}
                {podeGerarOrdem && (
                  <button
                    onClick={handleGerarOrdem}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <ClipboardList className="w-4 h-4" />
                    {actionLoading === "ordem" ? "A gerar…" : "Gerar Ordem"}
                  </button>
                )}
                {!podeEnviarSMS && !podeGerarOrdem && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400">
                    <AlertTriangle className="w-4 h-4" />
                    {alerta.resultado ? RESULTADO_LABELS[alerta.resultado]?.label : "Sem ações disponíveis"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
