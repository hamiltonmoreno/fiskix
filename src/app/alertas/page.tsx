"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentMesAno } from "@/lib/utils";
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
} from "lucide-react";
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

  // Load available zones
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

  // Reset page when filters change
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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 no-print">
        <h1 className="text-lg font-bold text-foreground">Alertas de Fraude</h1>
        <p className="text-sm text-muted-foreground">Gestão completa dos alertas gerados pelo motor de scoring</p>
      </header>

      <main className="p-6 space-y-4">

        {/* Filtros */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-3 no-print">
          <div>
            <label htmlFor="alertas-mes" className="block text-xs text-muted-foreground mb-1">Mês</label>
            <input
              id="alertas-mes"
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="px-3 py-1.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Estado</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Notificado_SMS">SMS Enviado</SelectItem>
                <SelectItem value="Pendente_Inspecao">Em Inspeção</SelectItem>
                <SelectItem value="Inspecionado">Inspecionado</SelectItem>
                <SelectItem value="Fraude_Confirmada">Fraude Confirmada</SelectItem>
                <SelectItem value="Anomalia_Tecnica">Anomalia Técnica</SelectItem>
                <SelectItem value="Falso_Positivo">Falso Positivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Zona</label>
            <Select value={zona} onValueChange={setZona}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as zonas</SelectItem>
                {zonas.map((z) => (
                  <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-end">
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer touch-manipulation"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> alertas encontrados
            </p>
            {totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Contador</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Titular</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Zona</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tarifa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Regras</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 animate-pulse rounded" />
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
                        className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { setAlertaSheet(alerta); setSheetOpen(true); }}
                      >
                        <td className="px-4 py-3">
                          <ScoreBadge score={alerta.score_risco} showScore />
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground text-xs">
                          {alerta.cliente.numero_contador}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {alerta.cliente.nome_titular}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {alerta.subestacao.zona_bairro}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {alerta.cliente.tipo_tarifa}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {regrasPontuadas.slice(0, 3).map((r) => (
                              <span
                                key={r.regra}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono"
                                title={r.descricao}
                              >
                                {r.regra}
                              </span>
                            ))}
                            {regrasPontuadas.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-xs">
                                +{regrasPontuadas.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={(alerta.status === "Inspecionado" && alerta.resultado) ? alerta.resultado : alerta.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {!isFinal && alerta.status === "Pendente" && (
                              <button
                                onClick={() => handleEnviarSMS(alerta.id)}
                                disabled={isLoading || !alerta.cliente.telemovel}
                                title={alerta.cliente.telemovel ? "Enviar SMS" : "Sem telemóvel registado"}
                                className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs transition-colors"
                              >
                                <MessageSquare className="w-3 h-3" />
                                SMS
                              </button>
                            )}
                            {!isFinal && (alerta.status === "Pendente" || alerta.status === "Notificado_SMS") && (
                              <button
                                onClick={() => handleGerarOrdem(alerta.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1 px-2 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg text-xs transition-colors"
                              >
                                <ClipboardList className="w-3 h-3" />
                                Ordem
                              </button>
                            )}
                            {alerta.status === "Inspecionado" && (
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
                                  className="p-1.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
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
                                  className="p-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
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
                                  className="p-1.5 bg-slate-400 hover:bg-slate-500 disabled:bg-slate-300 text-white rounded-lg transition-colors"
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

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Página anterior"
                  className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 cursor-pointer touch-manipulation"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label="Página seguinte"
                  className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 cursor-pointer touch-manipulation"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <AlertaSheet
        alerta={alertaSheet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEnviarSMS={handleEnviarSMS}
        onGerarOrdem={handleGerarOrdem}
        actionLoading={actionLoading}
      />

      {pendingStatusUpdate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-5">
            <h2 className="text-base font-semibold text-foreground">Confirmar atualização de estado</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Pretende marcar este alerta como <strong className="text-foreground">{pendingStatusUpdate.label}</strong>?
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setPendingStatusUpdate(null)}
                className="px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors cursor-pointer touch-manipulation"
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
                className="px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-sm text-primary-foreground transition-colors cursor-pointer touch-manipulation"
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
