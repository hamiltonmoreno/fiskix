"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getScoreColor, getScoreLabel, getCurrentMesAno } from "@/lib/utils";
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
import type { AlertaStatus, InspecaoResultado } from "@/types/database";

const ESTADOS_FINAIS: InspecaoResultado[] = [
  "Fraude_Confirmada",
  "Anomalia_Tecnica",
  "Falso_Positivo",
];

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  Pendente: { label: "Pendente", class: "bg-slate-100 text-slate-700" },
  Notificado_SMS: { label: "SMS Enviado", class: "bg-blue-100 text-blue-700" },
  Pendente_Inspecao: { label: "Em Inspeção", class: "bg-amber-100 text-amber-700" },
  Inspecionado: { label: "Inspecionado", class: "bg-green-100 text-green-700" },
  Fraude_Confirmada: { label: "Fraude Confirmada", class: "bg-red-100 text-red-700" },
  Anomalia_Tecnica: { label: "Anomalia Técnica", class: "bg-orange-100 text-orange-700" },
  Falso_Positivo: { label: "Falso Positivo", class: "bg-slate-100 text-slate-400" },
};

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
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

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
    setLoading(false);
  }, [mesAno, statusFilter, zona, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [mesAno, statusFilter, zona]);

  async function handleEnviarSMS(alerta: Alerta) {
    setActionLoading(alerta.id);
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
        body: JSON.stringify({ alerta_id: alerta.id, tipo }),
      }
    );
    const json = await res.json();
    if (!json.mensagem_enviada) {
      alert(`Erro ao enviar SMS: ${json.erro ?? "Desconhecido"}`);
    }
    await load();
    setActionLoading(null);
  }

  async function handleGerarOrdem(alertaId: string) {
    setActionLoading(alertaId);
    await supabase
      .from("alertas_fraude")
      .update({ status: "Pendente_Inspecao" })
      .eq("id", alertaId);
    await load();
    setActionLoading(null);
  }

  async function handleAtualizarStatus(alertaId: string, novoStatus: InspecaoResultado) {
    setActionLoading(alertaId);
    await supabase
      .from("alertas_fraude")
      .update({ resultado: novoStatus, status: "Inspecionado" as AlertaStatus })
      .eq("id", alertaId);
    await load();
    setActionLoading(null);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">Alertas de Fraude</h1>
        <p className="text-sm text-slate-400">Gestão completa dos alertas gerados pelo motor de scoring</p>
      </header>

      <main className="p-6 space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Mês</label>
            <input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Notificado_SMS">SMS Enviado</option>
              <option value="Pendente_Inspecao">Em Inspeção</option>
              <option value="Inspecionado">Inspecionado</option>
              <option value="Fraude_Confirmada">Fraude Confirmada</option>
              <option value="Anomalia_Tecnica">Anomalia Técnica</option>
              <option value="Falso_Positivo">Falso Positivo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Zona</label>
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todas">Todas as zonas</option>
              {zonas.map((z) => (
                <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-end">
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{total}</span> alertas encontrados
            </p>
            {totalPages > 1 && (
              <p className="text-xs text-slate-400">
                Página {page + 1} de {totalPages}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Contador</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Titular</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Zona</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Tarifa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Regras</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Ações</th>
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
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                      Nenhum alerta para os filtros selecionados
                    </td>
                  </tr>
                ) : (
                  alertas.map((alerta) => {
                    const scoreClass = getScoreColor(alerta.score_risco);
                    const scoreLabel = getScoreLabel(alerta.score_risco);
                    const displayStatus = (alerta.status === "Inspecionado" && alerta.resultado) ? alerta.resultado : alerta.status;
                    const statusInfo = STATUS_LABELS[displayStatus] ?? STATUS_LABELS.Pendente;
                    const regrasPontuadas = alerta.motivo.filter((r) => r.pontos > 0);
                    const isLoading = actionLoading === alerta.id;
                    const isFinal = ["Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"].includes(alerta.resultado ?? "");

                    return (
                      <tr key={alerta.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${scoreClass}`}>
                            {alerta.score_risco} · {scoreLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                          {alerta.cliente.numero_contador}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {alerta.cliente.nome_titular}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {alerta.subestacao.zona_bairro}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
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
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.class}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isFinal && alerta.status === "Pendente" && (
                              <button
                                onClick={() => handleEnviarSMS(alerta)}
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
                                  onClick={() => handleAtualizarStatus(alerta.id, "Fraude_Confirmada")}
                                  disabled={isLoading}
                                  title="Confirmar fraude"
                                  className="p-1.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleAtualizarStatus(alerta.id, "Anomalia_Tecnica")}
                                  disabled={isLoading}
                                  title="Anomalia técnica"
                                  className="p-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleAtualizarStatus(alerta.id, "Falso_Positivo")}
                                  disabled={isLoading}
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
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
