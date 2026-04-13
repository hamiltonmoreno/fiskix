"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentMesAno, formatMesAno } from "@/lib/utils";
import { toast } from "sonner";
import {
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Wrench,
  ClipboardList,
  FileDown,
} from "lucide-react";
import { exportToExcel } from "@/lib/export";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertaSheet, type AlertaSheetData } from "@/modules/alertas/components/AlertaSheet";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlertaStatus, InspecaoResultado } from "@/types/database";

const ESTADOS_FINAIS: InspecaoResultado[] = [
  "Fraude_Confirmada",
  "Anomalia_Tecnica",
  "Falso_Positivo",
];

interface Alerta {
  id: string;
  score_risco: number;
  status: string;
  mes_ano: string;
  resultado: string | null;
  motivo: Array<{ regra: string; pontos: number; descricao: string }>;
  cliente: {
    numero_contador: string;
    nome_titular: string;
    morada: string;
    tipo_tarifa: string;
    telemovel: string | null;
  };
  subestacao: { nome: string; zona_bairro: string };
}

const PAGE_SIZE = 15;

export default function AlertasPage() {
  const supabase = createClient();

  const [mesAno, setMesAno] = useState(getCurrentMesAno());
  const [statusFilter, setStatusFilter] = useState("todos");
  const [zona, setZona] = useState("todas");
  const [zonas, setZonas] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alertaSheet, setAlertaSheet] = useState<AlertaSheetData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    alertaId: string;
    novoStatus: InspecaoResultado;
    label: string;
  } | null>(null);

  useEffect(() => {
    supabase
      .from("subestacoes")
      .select("zona_bairro")
      .eq("ativo", true)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((s) => s.zona_bairro))].sort();
        setZonas(unique);
      });
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("alertas_fraude")
        .select(
          `id, score_risco, status, mes_ano, resultado, motivo,
           clientes!inner(numero_contador, nome_titular, morada, tipo_tarifa, telemovel,
             subestacoes!inner(nome, zona_bairro))`,
          { count: "exact" }
        )
        .eq("mes_ano", mesAno)
        .order("score_risco", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "todos") {
        if (ESTADOS_FINAIS.includes(statusFilter as InspecaoResultado)) {
          query = query
            .eq("status", "Inspecionado" as AlertaStatus)
            .eq("resultado", statusFilter as InspecaoResultado);
        } else {
          query = query.eq("status", statusFilter as AlertaStatus);
        }
      }

      if (zona !== "todas") {
        query = query.eq("clientes.subestacoes.zona_bairro", zona);
      }

      const { data: rows, count } = await query;

      const parsed: Alerta[] = (rows ?? []).map((r) => {
        const c = r.clientes as {
          numero_contador: string;
          nome_titular: string;
          morada: string;
          tipo_tarifa: string;
          telemovel: string | null;
          subestacoes: { nome: string; zona_bairro: string };
        };
        return {
          id: r.id,
          score_risco: r.score_risco,
          status: r.status,
          mes_ano: r.mes_ano,
          resultado: r.resultado,
          motivo: (r.motivo as Alerta["motivo"]) ?? [],
          cliente: {
            numero_contador: c.numero_contador,
            nome_titular: c.nome_titular,
            morada: c.morada,
            tipo_tarifa: c.tipo_tarifa,
            telemovel: c.telemovel,
          },
          subestacao: { nome: c.subestacoes.nome, zona_bairro: c.subestacoes.zona_bairro },
        };
      });

      setAlertas(parsed);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [mesAno, statusFilter, zona, page, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [mesAno, statusFilter, zona]);

  async function handleEnviarSMS(alertaId: string) {
    const alerta = alertas.find((a) => a.id === alertaId);
    if (!alerta) return;
    setActionLoading(alertaId);
    try {
      const tipo = alerta.score_risco >= 75 ? "vermelho" : "amarelo";
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ alerta_id: alertaId, tipo }),
        }
      );
      const json = await res.json();
      if (!json.mensagem_enviada) {
        toast.error(`Erro ao enviar SMS: ${json.erro ?? "Desconhecido"}`);
      } else {
        toast.success("SMS enviado com sucesso.");
      }
      await load();
    } catch {
      toast.error("Falha ao enviar SMS. Tente novamente.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGerarOrdem(alertaId: string) {
    setActionLoading(alertaId);
    try {
      await supabase
        .from("alertas_fraude")
        .update({ status: "Pendente_Inspecao" })
        .eq("id", alertaId);
      await load();
      toast.success("Ordem de inspeção gerada.");
    } catch {
      toast.error("Falha ao gerar ordem de inspeção.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAtualizarStatus(alertaId: string, novoStatus: InspecaoResultado) {
    setActionLoading(alertaId);
    try {
      await supabase
        .from("alertas_fraude")
        .update({ resultado: novoStatus, status: "Inspecionado" as AlertaStatus })
        .eq("id", alertaId);
      await load();
      toast.success("Estado do alerta atualizado.");
    } catch {
      toast.error("Falha ao atualizar o estado do alerta.");
    } finally {
      setActionLoading(null);
    }
  }

  function handleExportExcel() {
    const headers = ["Score", "Contador", "Titular", "Zona", "Tarifa", "Regras", "Estado", "Resultado", "Mês"];
    const rows = alertas.map((a) => ({
      "Score": a.score_risco,
      "Contador": a.cliente.numero_contador,
      "Titular": a.cliente.nome_titular,
      "Zona": a.subestacao.zona_bairro,
      "Tarifa": a.cliente.tipo_tarifa,
      "Regras": a.motivo.filter((r) => r.pontos > 0).map((r) => r.regra).join(", "),
      "Estado": a.status,
      "Resultado": a.resultado ?? "",
      "Mês": a.mes_ano,
    }));
    exportToExcel(`alertas_${mesAno}`, headers, rows);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">

      {/* Page hero */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
            Gestão · {formatMesAno(mesAno)}
          </p>
          <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
            Alertas de Fraude
          </h1>
          <p className="text-sm text-on-surface-variant mt-2">
            {total} alertas · Motor de scoring activo
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 no-print">
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            aria-label="Selecionar mês"
            className="px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
          />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold h-auto border-none ring-0 focus:ring-0 hover:bg-surface-container transition-colors [&>svg]:hidden">
              <SelectValue placeholder="Todos os estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Notificado_SMS">SMS Enviado</SelectItem>
              <SelectItem value="Pendente_Inspecao">Em Inspeção</SelectItem>
              <SelectItem value="Inspecionado">Inspecionado</SelectItem>
              <SelectItem value="Fraude_Confirmada">Fraude Confirmada</SelectItem>
              <SelectItem value="Anomalia_Tecnica">Anomalia Técnica</SelectItem>
              <SelectItem value="Falso_Positivo">Falso Positivo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zona} onValueChange={(v) => { setZona(v); setPage(0); }}>
            <SelectTrigger className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold h-auto border-none ring-0 focus:ring-0 hover:bg-surface-container transition-colors [&>svg]:hidden">
              <SelectValue placeholder="Todas as zonas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as zonas</SelectItem>
              {zonas.map((z) => (
                <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleExportExcel}
            disabled={alertas.length === 0}
            aria-label="Exportar para Excel"
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low disabled:opacity-40 cursor-pointer touch-manipulation transition-colors"
            title="Exportar Excel"
          >
            <FileDown className="w-4 h-4" />
          </button>
          <button
            onClick={load}
            aria-label="Atualizar alertas"
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low cursor-pointer touch-manipulation transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 text-left border-b border-surface-container-low">
                <th className="px-8 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Score</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contador</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Titular</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Zona</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tarifa</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Regras</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-8 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <Skeleton className="h-4 w-full rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : alertas.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={ClipboardList}
                      title="Nenhum alerta para os filtros selecionados"
                      description="Tente ajustar os filtros ou selecionar outro mês"
                    />
                  </td>
                </tr>
              ) : (
                alertas.map((alerta) => {
                  const regrasPontuadas = alerta.motivo.filter((r) => r.pontos > 0);
                  const isLoading = actionLoading === alerta.id;
                  const isFinal = ["Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"].includes(alerta.resultado ?? "");

                  return (
                    <tr
                      key={alerta.id}
                      className="hover:bg-surface-container-low/30 transition-colors cursor-pointer"
                      onClick={() => { setAlertaSheet(alerta); setSheetOpen(true); }}
                    >
                      <td className="px-8 py-5">
                        <ScoreBadge score={alerta.score_risco} showScore />
                      </td>
                      <td className="px-6 py-5 font-mono text-xs font-bold text-primary">
                        {alerta.cliente.numero_contador}
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-bold text-on-surface">{alerta.cliente.nome_titular}</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs text-on-surface-variant">{alerta.subestacao.zona_bairro.replace(/_/g, " ")}</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs text-on-surface-variant">{alerta.cliente.tipo_tarifa}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1">
                          {regrasPontuadas.slice(0, 3).map((r) => (
                            <span
                              key={r.regra}
                              className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded text-[10px] font-mono font-bold"
                              title={r.descricao}
                            >
                              {r.regra}
                            </span>
                          ))}
                          {regrasPontuadas.length > 3 && (
                            <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded text-[10px]">
                              +{regrasPontuadas.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <StatusBadge status={(alerta.status === "Inspecionado" && alerta.resultado) ? alerta.resultado : alerta.status} />
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {!isFinal && alerta.status === "Pendente" && (
                            <button
                              onClick={() => handleEnviarSMS(alerta.id)}
                              disabled={isLoading || !alerta.cliente.telemovel}
                              title={alerta.cliente.telemovel ? "Enviar SMS" : "Sem telemóvel registado"}
                              className="flex items-center gap-1 px-3 py-1.5 bg-primary-container text-white rounded-full text-[10px] font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
                            >
                              <MessageSquare className="w-3 h-3" />
                              SMS
                            </button>
                          )}
                          {!isFinal && (alerta.status === "Pendente" || alerta.status === "Notificado_SMS") && (
                            <button
                              onClick={() => handleGerarOrdem(alerta.id)}
                              disabled={isLoading}
                              className="flex items-center gap-1 px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-bold hover:bg-surface-container-highest disabled:opacity-40 transition-colors"
                            >
                              <ClipboardList className="w-3 h-3" />
                              Ordem
                            </button>
                          )}
                          {alerta.status === "Inspecionado" && !isFinal && (
                            <>
                              <button
                                onClick={() =>
                                  setPendingStatusUpdate({
                                    alertaId: alerta.id,
                                    novoStatus: "Fraude_Confirmada",
                                    label: "Fraude Confirmada",
                                  })
                                }
                                disabled={isLoading}
                                aria-label="Marcar como fraude confirmada"
                                title="Confirmar fraude"
                                className="p-1.5 bg-[#ffdad6] text-[#ba1a1a] rounded-full hover:bg-[#ba1a1a] hover:text-white transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setPendingStatusUpdate({
                                    alertaId: alerta.id,
                                    novoStatus: "Anomalia_Tecnica",
                                    label: "Anomalia Técnica",
                                  })
                                }
                                disabled={isLoading}
                                aria-label="Marcar como anomalia técnica"
                                title="Anomalia técnica"
                                className="p-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-500 hover:text-white transition-colors"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setPendingStatusUpdate({
                                    alertaId: alerta.id,
                                    novoStatus: "Falso_Positivo",
                                    label: "Falso Positivo",
                                  })
                                }
                                disabled={isLoading}
                                aria-label="Marcar como falso positivo"
                                title="Falso positivo"
                                className="p-1.5 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-container-highest transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Página anterior"
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer touch-manipulation"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label="Página seguinte"
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer touch-manipulation"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AlertaSheet
        alerta={alertaSheet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEnviarSMS={handleEnviarSMS}
        onGerarOrdem={handleGerarOrdem}
        actionLoading={actionLoading}
      />

      {/* Confirm dialog */}
      {pendingStatusUpdate && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-[1.5rem] bg-surface-container-lowest shadow-xl p-6">
            <h2 className="text-base font-bold text-on-surface">Confirmar atualização</h2>
            <p className="text-sm text-on-surface-variant mt-2">
              Marcar este alerta como{" "}
              <strong className="text-on-surface">{pendingStatusUpdate.label}</strong>?
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setPendingStatusUpdate(null)}
                className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-sm font-bold hover:bg-surface-container transition-colors cursor-pointer touch-manipulation"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await handleAtualizarStatus(
                    pendingStatusUpdate.alertaId,
                    pendingStatusUpdate.novoStatus
                  );
                  setPendingStatusUpdate(null);
                }}
                className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors cursor-pointer touch-manipulation"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
