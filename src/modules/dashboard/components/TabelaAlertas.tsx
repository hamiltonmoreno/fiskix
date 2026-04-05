"use client";

import { useState } from "react";
import { useAlertas } from "../hooks/useAlertas";
import { getScoreColor, getScoreLabel, formatMesAno } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";
import { MessageSquare, ClipboardList, ChevronLeft, ChevronRight, RefreshCw, Eye, FileDown } from "lucide-react";
import { AlertaDetalheModal } from "./AlertaDetalheModal";
import type { AlertaTabela } from "../types";

interface TabelaAlertasProps {
  mesAno: string;
  zona?: string;
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  Pendente: { label: "Pendente", class: "bg-slate-100 text-slate-700" },
  Notificado_SMS: { label: "SMS Enviado", class: "bg-blue-100 text-blue-700" },
  Pendente_Inspecao: { label: "Em Inspeção", class: "bg-amber-100 text-amber-700" },
  Inspecionado: { label: "Inspecionado", class: "bg-green-100 text-green-700" },
  Fraude_Confirmada: { label: "Fraude Confirmada", class: "bg-red-100 text-red-700" },
  Anomalia_Tecnica: { label: "Anomalia Técnica", class: "bg-orange-100 text-orange-700" },
  Falso_Positivo: { label: "Falso Positivo", class: "bg-slate-100 text-slate-400" },
};

export function TabelaAlertas({ mesAno, zona }: TabelaAlertasProps) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alertaDetalhe, setAlertaDetalhe] = useState<AlertaTabela | null>(null);
  const pageSize = 10;

  const { data, total, loading, reload, enviarSMS, gerarOrdem } = useAlertas({
    mesAno,
    zona,
    statusFilter,
    page,
    pageSize,
  });

  function handleExportExcel() {
    const headers = ["Score", "Contador", "Titular", "Zona", "Tarifa", "Regras", "Estado", "Resultado", "Mês"];
    const rows = data.map((a) => ({
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

  async function handleEnviarSMS(alertaId: string, score: number) {
    setActionLoading(alertaId);
    const tipo = score >= 75 ? "vermelho" : "amarelo";
    const res = await enviarSMS(alertaId, tipo);
    if (res.mensagem_enviada) {
      await reload();
    } else {
      alert(`Erro ao enviar SMS: ${res.erro ?? "Desconhecido"}`);
    }
    setActionLoading(null);
  }

  async function handleGerarOrdem(alertaId: string) {
    setActionLoading(alertaId);
    await gerarOrdem(alertaId);
    setActionLoading(null);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-700">Alertas de Risco</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {total} alertas · {formatMesAno(mesAno)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os estados</option>
            <option value="Pendente">Pendente</option>
            <option value="Notificado_SMS">SMS Enviado</option>
            <option value="Pendente_Inspecao">Em Inspeção</option>
            <option value="Inspecionado">Inspecionado</option>
            <option value="Fraude_Confirmada">Fraude Confirmada</option>
            <option value="Anomalia_Tecnica">Anomalia Técnica</option>
            <option value="Falso_Positivo">Falso Positivo</option>
          </select>
          <button
            onClick={handleExportExcel}
            disabled={data.length === 0}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40"
            title="Exportar Excel"
          >
            <FileDown className="w-4 h-4" />
          </button>
          <button
            onClick={reload}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
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
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  Nenhum alerta encontrado para os filtros selecionados
                </td>
              </tr>
            ) : (
              data.map((alerta) => {
                const scoreClass = getScoreColor(alerta.score_risco);
                const scoreLabel = getScoreLabel(alerta.score_risco);
                const displayStatus = (alerta.status === "Inspecionado" && alerta.resultado) ? alerta.resultado : alerta.status;
                const statusInfo = STATUS_LABELS[displayStatus] ?? STATUS_LABELS.Pendente;
                const regrasPontuadas = alerta.motivo.filter((r) => r.pontos > 0);
                const isLoading = actionLoading === alerta.id;
                const podeEnviarSMS = alerta.status === "Pendente";
                const podeGerarOrdem =
                  alerta.status === "Pendente" ||
                  alerta.status === "Notificado_SMS";

                return (
                  <tr
                    key={alerta.id}
                    className="border-b border-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => setAlertaDetalhe(alerta)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${scoreClass}`}
                      >
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
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.class}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setAlertaDetalhe(alerta)}
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {podeEnviarSMS && (
                          <button
                            onClick={() =>
                              handleEnviarSMS(alerta.id, alerta.score_risco)
                            }
                            disabled={isLoading || !alerta.cliente.telemovel}
                            title={
                              alerta.cliente.telemovel
                                ? "Enviar SMS"
                                : "Sem telemóvel registado"
                            }
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" />
                            SMS
                          </button>
                        )}
                        {podeGerarOrdem && (
                          <button
                            onClick={() => handleGerarOrdem(alerta.id)}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg text-xs transition-colors"
                          >
                            <ClipboardList className="w-3 h-3" />
                            Ordem
                          </button>
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
            Página {page + 1} de {totalPages} · {total} alertas
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de detalhe */}
      <AlertaDetalheModal
        alerta={alertaDetalhe}
        open={alertaDetalhe !== null}
        onClose={() => setAlertaDetalhe(null)}
        onAction={() => { reload(); }}
      />
    </div>
  );
}
