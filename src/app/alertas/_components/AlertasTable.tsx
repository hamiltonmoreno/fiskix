"use client";

import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Wrench,
  ClipboardList,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { InspecaoResultado } from "@/types/database";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";

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

interface AlertasTableProps {
  alertas: Alerta[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  actionLoading: string | null;
  sortDir?: "asc" | "desc";
  onRowClick: (alerta: Alerta) => void;
  onEnviarSMS: (alertaId: string) => void;
  onGerarOrdem: (alertaId: string) => void;
  onSetPendingStatus: (update: { alertaId: string; novoStatus: InspecaoResultado; label: string }) => void;
  onPageChange: (page: number) => void;
  onSortChange?: (dir: "asc" | "desc") => void;
}

const ESTADOS_FINAIS = ["Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"];

export function AlertasTable({
  alertas,
  loading,
  total,
  page,
  pageSize,
  actionLoading,
  sortDir,
  onRowClick,
  onEnviarSMS,
  onGerarOrdem,
  onSetPendingStatus,
  onPageChange,
  onSortChange,
}: AlertasTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 uppercase border-b border-gray-200 dark:border-gray-700/60">
            <tr>
              <th className="px-8 py-4 font-semibold tracking-wider">
                {onSortChange ? (
                  <button
                    onClick={() => onSortChange(sortDir === "asc" ? "desc" : "asc")}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    Score
                    {sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  </button>
                ) : "Score"}
              </th>
              {["Contador", "Titular", "Zona", "Tarifa", "Regras", "Estado"].map((h) => (
                <th key={h} className="px-6 py-4 font-semibold tracking-wider">{h}</th>
              ))}
              <th className="px-8 py-4 font-semibold tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
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
                const isFinal = ESTADOS_FINAIS.includes(alerta.resultado ?? "");

                return (
                  <tr
                    key={alerta.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
                    onClick={() => onRowClick(alerta)}
                  >
                    <td className="px-8 py-5">
                      <ScoreBadge score={alerta.score_risco} showScore />
                    </td>
                    <td className="px-6 py-5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {alerta.cliente.numero_contador}
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{alerta.cliente.nome_titular}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-gray-500 dark:text-gray-400">{alerta.subestacao.zona_bairro.replace(/_/g, " ")}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-gray-500 dark:text-gray-400">{alerta.cliente.tipo_tarifa}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {regrasPontuadas.slice(0, 3).map((r) => (
                          <span
                            key={r.regra}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded font-mono text-[10px] font-medium"
                            title={r.descricao}
                          >
                            {r.regra}
                          </span>
                        ))}
                        {regrasPontuadas.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50 rounded text-[10px]">
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
                            onClick={() => { haptics.medium(); onEnviarSMS(alerta.id); }}
                            disabled={isLoading || !alerta.cliente.telemovel}
                            title={alerta.cliente.telemovel ? "Enviar SMS" : "Sem telemóvel registado"}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            SMS
                          </button>
                        )}
                        {!isFinal && (alerta.status === "Pendente" || alerta.status === "Notificado_SMS") && (
                          <button
                            onClick={() => { haptics.medium(); onGerarOrdem(alerta.id); }}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Ordem
                          </button>
                        )}
                        {alerta.status === "Inspecionado" && !isFinal && (
                          <>
                            <button
                              onClick={() => { haptics.light(); onSetPendingStatus({ alertaId: alerta.id, novoStatus: "Fraude_Confirmada", label: "Fraude Confirmada" }); }}
                              disabled={isLoading}
                              aria-label="Marcar como fraude confirmada"
                              title="Confirmar fraude"
                              className="p-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-md hover:bg-red-600 hover:text-white transition-colors touch-manipulation"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { haptics.light(); onSetPendingStatus({ alertaId: alerta.id, novoStatus: "Anomalia_Tecnica", label: "Anomalia Técnica" }); }}
                              disabled={isLoading}
                              aria-label="Marcar como anomalia técnica"
                              title="Anomalia técnica"
                              className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md hover:bg-amber-500 hover:text-white transition-colors touch-manipulation"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { haptics.light(); onSetPendingStatus({ alertaId: alerta.id, novoStatus: "Falso_Positivo", label: "Falso Positivo" }); }}
                              disabled={isLoading}
                              aria-label="Marcar como falso positivo"
                              title="Falso positivo"
                              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation"
                            >
                              <XCircle className="w-4 h-4" />
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

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { haptics.light(); onPageChange(Math.max(0, page - 1)); }}
              disabled={page === 0}
              aria-label="Página anterior"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer touch-manipulation transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => { haptics.light(); onPageChange(Math.min(totalPages - 1, page + 1)); }}
              disabled={page >= totalPages - 1}
              aria-label="Página seguinte"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer touch-manipulation transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
