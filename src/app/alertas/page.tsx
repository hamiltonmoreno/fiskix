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
import { AlertasConfirmDialog } from "./_components/AlertasConfirmDialog";
import { logger } from "@/lib/observability/logger";
import { MessageSquare, Mail, ClipboardList, Download, X } from "lucide-react";

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
    email: string | null;
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
  const [search, setSearch] = useState("");
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
  const [bulkLoading, setBulkLoading] = useState(false);

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
           clientes!inner(numero_contador, nome_titular, morada, tipo_tarifa, telemovel, email,
             subestacoes!inner(nome, zona_bairro))`,
          { count: "exact" }
        )
        .eq("mes_ano", mesAno)
        .order("score_risco", { ascending: sortDir === "asc" })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`clientes.nome_titular.ilike.${term},clientes.numero_contador.ilike.${term}`);
      }

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
          email: string | null;
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
            email: c.email,
          },
          subestacao: { nome: c.subestacoes.nome, zona_bairro: c.subestacoes.zona_bairro },
        };
      });

      setAlertas(parsed);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [mesAno, statusFilter, zona, search, page, sortDir, supabase]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); setSelectedIds(new Set()); }, [mesAno, statusFilter, zona, search]);

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

  async function handleEnviarEmail(alertaId: string) {
    const alerta = alertas.find((a) => a.id === alertaId);
    if (!alerta) return;
    setActionLoading(alertaId);
    try {
      const tipo = alerta.score_risco >= 75 ? "vermelho" : "amarelo";
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ alerta_id: alertaId, tipo }) }
      );
      const json = await res.json();
      if (!json.mensagem_enviada) {
        toast.error(`Erro ao enviar email: ${json.erro ?? "Desconhecido"}`);
      } else {
        toast.success("Email enviado com sucesso.");
      }
    } catch (err) {
      logger({ page: "alertas" }).error("email_send_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("Falha ao enviar email. Tente novamente.");
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

  function handleExportSelected() {
    const selecionados = alertas.filter((a) => selectedIds.has(a.id));
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

  async function handleBulkSMS() {
    const alvos = alertas.filter((a) => selectedIds.has(a.id) && a.status === "Pendente" && a.cliente.telemovel);
    if (alvos.length === 0) {
      toast.error("Nenhum alerta selecionado elegível para SMS (requer estado Pendente e telemóvel).");
      return;
    }
    setBulkLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      let ok = 0;
      let fail = 0;
      for (const alerta of alvos) {
        const tipo = alerta.score_risco >= 75 ? "vermelho" : "amarelo";
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms`,
            { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ alerta_id: alerta.id, tipo }) }
          );
          const json = await res.json();
          if (json.mensagem_enviada) ok++; else fail++;
        } catch {
          fail++;
        }
      }
      toast.success(`SMS em lote: ${ok} enviados${fail > 0 ? `, ${fail} falharam` : ""}.`);
      setSelectedIds(new Set());
      await load();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkEmail() {
    const alvos = alertas.filter((a) => selectedIds.has(a.id) && a.status === "Pendente" && a.cliente.email);
    if (alvos.length === 0) {
      toast.error("Nenhum alerta selecionado elegível para email (requer estado Pendente e email registado).");
      return;
    }
    setBulkLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      let ok = 0;
      let fail = 0;
      for (const alerta of alvos) {
        const tipo = alerta.score_risco >= 75 ? "vermelho" : "amarelo";
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
            { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ alerta_id: alerta.id, tipo }) }
          );
          const json = await res.json();
          if (json.mensagem_enviada) ok++; else fail++;
        } catch {
          fail++;
        }
      }
      toast.success(`Email em lote: ${ok} enviados${fail > 0 ? `, ${fail} falharam` : ""}.`);
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkGerarOrdem() {
    const alvos = alertas.filter((a) => selectedIds.has(a.id) && (a.status === "Pendente" || a.status === "Notificado_SMS"));
    if (alvos.length === 0) {
      toast.error("Nenhum alerta selecionado elegível para ordem de inspeção.");
      return;
    }
    setBulkLoading(true);
    try {
      const ids = alvos.map((a) => a.id);
      await supabase.from("alertas_fraude").update({ status: "Pendente_Inspecao" as AlertaStatus }).in("id", ids);
      toast.success(`${ids.length} ordens de inspeção geradas.`);
      setSelectedIds(new Set());
      await load();
    } catch {
      toast.error("Falha ao gerar ordens em lote.");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <AlertasFilters
        mesAno={mesAno}
        statusFilter={statusFilter}
        zona={zona}
        zonas={zonas}
        search={search}
        hasAlertas={alertas.length > 0}
        defaultMesAno={getCurrentMesAno()}
        onMesAnoChange={setMesAno}
        onStatusChange={(v) => { setStatusFilter(v); setPage(0); }}
        onZonaChange={(v) => { setZona(v); setPage(0); }}
        onSearchChange={(v) => { setSearch(v); setPage(0); }}
        onClear={() => { setMesAno(getCurrentMesAno()); setStatusFilter("todos"); setZona("todas"); setSearch(""); setPage(0); }}
        onExport={handleExportExcel}
        onRefresh={load}
      />

      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        {total} alertas · Monitorização Ativa
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex-1">
            {selectedIds.size} alerta{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={handleBulkSMS}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            SMS em lote
          </button>
          <button
            onClick={handleBulkEmail}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-md text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Email em lote
          </button>
          <button
            onClick={handleBulkGerarOrdem}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Gerar ordens
          </button>
          <button
            onClick={handleExportSelected}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            aria-label="Limpar seleção"
            className="p-1.5 rounded-md text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
        <AlertasTable
          alertas={alertas}
          loading={loading}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          actionLoading={actionLoading}
          selectedIds={selectedIds}
          onToggleSelect={(id) => setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          })}
          onToggleAll={(allIds) => setSelectedIds((prev) => {
            const allSelected = allIds.every((id) => prev.has(id));
            const next = new Set(prev);
            if (allSelected) { allIds.forEach((id) => next.delete(id)); }
            else { allIds.forEach((id) => next.add(id)); }
            return next;
          })}
          onRowClick={(a) => { setAlertaSheet(a); setSheetOpen(true); }}
          onEnviarSMS={handleEnviarSMS}
          onEnviarEmail={handleEnviarEmail}
          onGerarOrdem={handleGerarOrdem}
          onSetPendingStatus={setPendingStatusUpdate}
          onPageChange={setPage}
          sortDir={sortDir}
          onSortChange={(dir) => { setSortDir(dir); setPage(0); }}
        />
      </div>

      <AlertaSheet
        alerta={alertaSheet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEnviarSMS={handleEnviarSMS}
        onEnviarEmail={handleEnviarEmail}
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
