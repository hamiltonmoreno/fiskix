"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Phone, MapPin, Hash, Tag, AlertTriangle, ClipboardCheck, MessageSquare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMesAno } from "@/lib/utils";

interface Props {
  clienteId: string | null;
  open: boolean;
  onClose: () => void;
}

interface FichaData {
  cliente: {
    nome_titular: string;
    numero_contador: string;
    morada: string;
    tipo_tarifa: string;
    telemovel: string | null;
    subestacoes: { nome: string; zona_bairro: string };
  };
  faturacao: Array<{ mes_ano: string; kwh_faturado: number; valor_cve: number }>;
  alertas: Array<{ id: string; mes_ano: string; score_risco: number; status: string; resultado: string | null }>;
  inspecoes: Array<{ id: string; criado_em: string; resultado: string; foto_url: string | null; observacoes: string | null }>;
  smsCount: number;
}

export function ClienteFichaSheet({ clienteId, open, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<FichaData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !clienteId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [clienteRes, faturacaoRes, alertasRes, inspecoesRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("nome_titular, numero_contador, morada, tipo_tarifa, telemovel, subestacoes!inner(nome, zona_bairro)")
          .eq("id", clienteId)
          .single(),
        supabase
          .from("faturacao_clientes")
          .select("mes_ano, kwh_faturado, valor_cve")
          .eq("id_cliente", clienteId)
          .order("mes_ano", { ascending: true })
          .limit(24),
        supabase
          .from("alertas_fraude")
          .select("id, mes_ano, score_risco, status, resultado")
          .eq("id_cliente", clienteId)
          .order("mes_ano", { ascending: false })
          .limit(20),
        supabase
          .from("relatorios_inspecao")
          .select("id, criado_em, resultado, foto_url, observacoes, alertas_fraude!inner(id_cliente)")
          .eq("alertas_fraude.id_cliente", clienteId)
          .order("criado_em", { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      if (clienteRes.data) {
        const alertas = (alertasRes.data ?? []) as FichaData["alertas"];
        setData({
          cliente: clienteRes.data as unknown as FichaData["cliente"],
          faturacao: (faturacaoRes.data ?? []) as FichaData["faturacao"],
          alertas,
          inspecoes: (inspecoesRes.data ?? []) as unknown as FichaData["inspecoes"],
          smsCount: alertas.filter((a) => a.status === "Notificado_SMS" || a.status === "Pendente_Inspecao" || a.status === "Inspecionado").length,
        });
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [clienteId, open, supabase]);

  const media = data && data.faturacao.length > 0
    ? data.faturacao.reduce((s, f) => s + f.kwh_faturado, 0) / data.faturacao.length
    : 0;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
          <Dialog.Title className="sr-only">Ficha do cliente</Dialog.Title>

          <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-gray-700/60">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-gray-100">
                {loading ? "A carregar…" : data?.cliente.nome_titular ?? "—"}
              </h2>
              {data && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 font-mono"><Hash className="w-3 h-3" />{data.cliente.numero_contador}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{data.cliente.subestacoes.zona_bairro.replace(/_/g, " ")}</span>
                  <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" />{data.cliente.tipo_tarifa}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {data && (
              <>
                {/* Mini KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MiniKpi icon={AlertTriangle} label="Alertas" value={data.alertas.length} tone="amber" />
                  <MiniKpi icon={ClipboardCheck} label="Inspeções" value={data.inspecoes.length} tone="blue" />
                  <MiniKpi icon={MessageSquare} label="SMS enviados" value={data.smsCount} tone="default" />
                  <MiniKpi icon={Phone} label="Telemóvel" value={data.cliente.telemovel ?? "—"} tone="default" small />
                </div>

                {/* Morada */}
                <div className="bg-slate-50 dark:bg-gray-900/40 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Morada</p>
                  <p className="text-sm text-slate-700 dark:text-gray-200">{data.cliente.morada}</p>
                </div>

                {/* Histórico consumo */}
                <section>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Histórico de consumo (kWh)
                  </h4>
                  {data.faturacao.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-gray-400 py-4">Sem histórico de faturação.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.faturacao.slice(-12).map((f) => ({ mes: f.mes_ano.slice(5), kwh: f.kwh_faturado }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} />
                        <Tooltip formatter={(v: number) => [`${v} kWh`, "Consumo"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <ReferenceLine y={media} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: "média", fontSize: 9, fill: "#94A3B8" }} />
                        <Bar dataKey="kwh" fill="#0058bc" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </section>

                {/* Alertas */}
                <section>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Histórico de alertas
                  </h4>
                  {data.alertas.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-gray-400 py-4">Sem alertas registados.</p>
                  ) : (
                    <div className="rounded-lg border border-slate-100 dark:border-gray-700/60 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Mês</th>
                            <th className="px-3 py-2 text-left font-medium">Score</th>
                            <th className="px-3 py-2 text-left font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-gray-700/40">
                          {data.alertas.map((a) => (
                            <tr key={a.id}>
                              <td className="px-3 py-2 text-slate-700 dark:text-gray-200 font-mono text-xs">{formatMesAno(a.mes_ano)}</td>
                              <td className="px-3 py-2"><ScoreBadge score={a.score_risco} showScore /></td>
                              <td className="px-3 py-2">
                                <StatusBadge status={a.status === "Inspecionado" && a.resultado ? a.resultado : a.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Inspeções */}
                {data.inspecoes.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Inspeções
                    </h4>
                    <ul className="space-y-2">
                      {data.inspecoes.map((i) => (
                        <li key={i.id} className="bg-slate-50 dark:bg-gray-900/40 rounded-lg p-3 flex items-start gap-3">
                          {i.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.foto_url} alt="Foto inspeção" className="w-16 h-16 object-cover rounded-md shrink-0" />
                          ) : (
                            <div className="w-16 h-16 bg-slate-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-slate-400 text-xs shrink-0">sem foto</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <StatusBadge status={i.resultado} />
                              <span className="text-xs text-slate-500 dark:text-gray-400">
                                {new Date(i.criado_em).toLocaleDateString("pt-CV", { dateStyle: "medium" })}
                              </span>
                            </div>
                            {i.observacoes && <p className="text-xs text-slate-600 dark:text-gray-300 line-clamp-2">{i.observacoes}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
  tone,
  small,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: "default" | "amber" | "blue";
  small?: boolean;
}) {
  const colors = {
    default: "text-slate-900 dark:text-gray-100",
    amber: "text-amber-700 dark:text-amber-400",
    blue: "text-blue-700 dark:text-blue-400",
  } as const;
  return (
    <div className="bg-slate-50 dark:bg-gray-900/40 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`${small ? "text-sm" : "text-base"} font-bold ${colors[tone]} truncate`}>{value}</p>
    </div>
  );
}
