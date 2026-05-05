"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentMesAno } from "@/lib/utils";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/export";
import { AlertaSheet, type AlertaSheetData } from "@/modules/alertas/components/AlertaSheet";
import type { AlertaStatus, InspecaoResultado } from "@/types/database";
import { AlertasFilters } from "./_components/AlertasFilters";
import { AlertasTable } from "./_components/AlertasTable";
import { AlertasBulkBar } from "./_components/AlertasBulkBar";
import { AlertasConfirmDialog } from "./_components/AlertasConfirmDialog";
import { logger } from "@/lib/observability/logger";

interface Alerta {
  id: string;
  score_risco: number;
  status: string;
  mes_ano: string;
  resultado: string | null;
  criado_em: string;
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
  const supabase = useMemo(() => createClient(), []);

  const [mesAno, setMesAno] = useState(getCurrentMesAno());
  const [statusFilter, setStatusFilter] = useState("todos");
  const [zona, setZona] = useState("todas");
  const [zonas, setZonas] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Twilio cobra por SMS — limite defensivo por click para evitar custos imprevistos
  // ou hammering acidental. Se utilizador realmente precisa de mais, faz outro batch.
  const BULK_SMS_MAX = 30;

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
          `id, score_risco, status, mes_ano, resultado, motivo, criado_em,
           clientes!inner(numero_contador, nome_titular, morada, tipo_tarifa, telemovel,
             subestacoes!inner(nome, zona_bairro))`,
          { count: "exact" }
        )
        .eq("mes_ano", mesAno)
        .order("score_risco", { ascending: sortDir === "asc" })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "todos") {
        const ESTADOS_FINAIS: InspecaoResultado[] = ["Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"];
        if (ESTADOS_FINAIS.includes(statusFilter as InspecaoResultado)) {
          query = query.eq("status", "Inspecionado" as AlertaStatus).eq("resultado", statusFilter as InspecaoResultado);
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
          criado_em: r.criado_em,
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
  }, [mesAno, statusFilter, zona, page, sortDir, supabase]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [mesAno, statusFilter, zona]);
  // Limpar selecção quando filtros mudam (alertas em vista mudaram)
  useEffect(() => { setSelectedIds(new Set()); }, [mesAno, statusFilter, zona, page]);

  function toggleSelect(alertaId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(alertaId)) next.delete(alertaId);
      else next.add(alertaId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allInView = alertas.map((a) => a.id);
      const allSelected = allInView.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allInView.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      allInView.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearSelection() { setSelectedIds(new Set()); }

  // Para SMS: precisam de telemovel + status === "Pendente"
  const smsEligibleSelected = alertas.filter(
    (a) => selectedIds.has(a.id) && a.cliente.telemovel && a.status === "Pendente",
  );
  // Para Ordem: status pode ser Pendente ou Notificado_SMS
  const ordemEligibleSelected = alertas.filter(
    (a) =>
      selectedIds.has(a.id) &&
      (a.status === "Pendente" || a.status === "Notificado_SMS"),
  );

  async function handleBulkSMS() {
    if (smsEligibleSelected.length === 0) return;
    if (smsEligibleSelected.length > BULK_SMS_MAX) {
      toast.error(`Máximo ${BULK_SMS_MAX} SMS por batch (selecionados: ${smsEligibleSelected.length}). Reduza a seleção.`);
      return;
    }
    setBulkBusy(true);
    let ok = 0, fail = 0;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      // Sequencial para respeitar rate limit do edge function (60 req/min)
      // e dar feedback gradual em caso de erro.
      for (const a of smsEligibleSelected) {
        try {
          const tipo = a.score_risco >= 75 ? "vermelho" : "amarelo";
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms`,
            { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ alerta_id: a.id, tipo }) }
          );
          const json = await res.json();
          if (json.mensagem_enviada) ok++; else fail++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) toast.success(`${ok} SMS enviado${ok === 1 ? "" : "s"}.`);
      if (fail > 0) toast.error(`${fail} SMS falhou${fail === 1 ? "" : "ram"}.`);
      clearSelection();
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkOrdem() {
    if (ordemEligibleSelected.length === 0) return;
    setBulkBusy(true);
    try {
      const ids = ordemEligibleSelected.map((a) => a.id);
      const { error } = await supabase
        .from("alertas_fraude")
        .update({ status: "Pendente_Inspecao" })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} ordem${ids.length === 1 ? "" : "s"} de inspeção criada${ids.length === 1 ? "" : "s"}.`);
      clearSelection();
      await load();
    } catch (err) {
      logger({ page: "alertas" }).error("bulk_ordem_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("Falha ao criar ordens em massa.");
    } finally {
      setBulkBusy(false);
    }
  }

  function handleBulkExport() {
    const selecionados = alertas.filter((a) => selectedIds.has(a.id));
    if (selecionados.length === 0) return;
    const headers = ["Score", "Contador", "Titular", "Zona", "Tarifa", "Regras", "Estado", "Resultado", "Mês"];
    const rows = selecionados.map((a) => ({
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
    exportToExcel(`alertas_selecionados_${mesAno}`, headers, rows);
  }

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
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ alerta_id: alertaId, tipo }) }
      );
      const json = await res.json();
      if (!json.mensagem_enviada) {
        toast.error(`Erro ao enviar SMS: ${json.erro ?? "Desconhecido"}`);
      } else {
        toast.success("SMS enviado com sucesso.");
      }
      await load();
    } catch (err) {
      logger({ page: "alertas" }).error("sms_send_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("Falha ao enviar SMS. Tente novamente.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGerarOrdem(alertaId: string) {
    setActionLoading(alertaId);
    try {
      await supabase.from("alertas_fraude").update({ status: "Pendente_Inspecao" }).eq("id", alertaId);
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
      await supabase.from("alertas_fraude").update({ resultado: novoStatus, status: "Inspecionado" as AlertaStatus }).eq("id", alertaId);
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <AlertasFilters
        mesAno={mesAno}
        statusFilter={statusFilter}
        zona={zona}
        zonas={zonas}
        hasAlertas={alertas.length > 0}
        defaultMesAno={getCurrentMesAno()}
        onMesAnoChange={setMesAno}
        onStatusChange={(v) => { setStatusFilter(v); setPage(0); }}
        onZonaChange={(v) => { setZona(v); setPage(0); }}
        onClear={() => { setMesAno(getCurrentMesAno()); setStatusFilter("todos"); setZona("todas"); setPage(0); }}
        onExport={handleExportExcel}
        onRefresh={load}
      />

      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        {total} alertas · Monitorização Ativa
      </div>

      <AlertasBulkBar
        selectedCount={selectedIds.size}
        smsEligibleCount={smsEligibleSelected.length}
        ordemEligibleCount={ordemEligibleSelected.length}
        busy={bulkBusy}
        onClear={clearSelection}
        onBulkSMS={handleBulkSMS}
        onBulkOrdem={handleBulkOrdem}
        onBulkExport={handleBulkExport}
      />

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
        <AlertasTable
        alertas={alertas}
        loading={loading}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        actionLoading={actionLoading}
        selectedIds={selectedIds}
        onRowClick={(a) => { setAlertaSheet(a); setSheetOpen(true); }}
        onEnviarSMS={handleEnviarSMS}
        onGerarOrdem={handleGerarOrdem}
        onSetPendingStatus={setPendingStatusUpdate}
        onPageChange={setPage}
        sortDir={sortDir}
        onSortChange={(dir) => { setSortDir(dir); setPage(0); }}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
      />
      </div>

      <AlertaSheet
        alerta={alertaSheet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEnviarSMS={handleEnviarSMS}
        onGerarOrdem={handleGerarOrdem}
        actionLoading={actionLoading}
      />

      {pendingStatusUpdate && (
        <AlertasConfirmDialog
          pending={pendingStatusUpdate}
          onConfirm={async (id, status) => {
            await handleAtualizarStatus(id, status);
            setPendingStatusUpdate(null);
          }}
          onCancel={() => setPendingStatusUpdate(null)}
        />
      )}
    </div>
  );
}
