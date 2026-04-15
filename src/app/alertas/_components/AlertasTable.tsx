"use client";

import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { InspecaoResultado } from "@/types/database";

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
  onRowClick: (alerta: Alerta) => void;
  onEnviarSMS: (alertaId: string) => void;
  onGerarOrdem: (alertaId: string) => void;
  onSetPendingStatus: (update: { alertaId: string; novoStatus: InspecaoResultado; label: string }) => void;
  onPageChange: (page: number) => void;
}

const ESTADOS_FINAIS = ["Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"];

export function AlertasTable({
  alertas,
  loading,
  total,
  page,
  pageSize,
  actionLoading,
  onRowClick,
  onEnviarSMS,
  onGerarOrdem,
  onSetPendingStatus,
  onPageChange,
}: AlertasTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-container-low/50 text-left border-b border-surface-container-low">
              {["Score", "Contador", "Titular", "Zona", "Tarifa", "Regras", "Estado", "Ações"].map((h) => (
                <th key={h} className={`px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest ${h === "Ações" ? "text-right px-8" : h === "Score" ? "px-8" : ""}`}>
                  {h}
                </th>
              ))}
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
                const isFinal = ESTADOS_FINAIS.includes(alerta.resultado ?? "");

                return (
                  <tr
                    key={alerta.id}
                    className="hover:bg-surface-container-low/30 transition-colors cursor-pointer"
                    onClick={() => onRowClick(alerta)}
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
                            onClick={() => onEnviarSMS(alerta.id)}
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
                            onClick={() => onGerarOrdem(alerta.id)}
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
                              onClick={() => onSetPendingStatus({ alertaId: alerta.id, novoStatus: "Fraude_Confirmada", label: "Fraude Confirmada" })}
                              disabled={isLoading}
                              aria-label="Marcar como fraude confirmada"
                              title="Confirmar fraude"
                              className="p-1.5 bg-[#ffdad6] text-[#ba1a1a] rounded-full hover:bg-[#ba1a1a] hover:text-white transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onSetPendingStatus({ alertaId: alerta.id, novoStatus: "Anomalia_Tecnica", label: "Anomalia Técnica" })}
                              disabled={isLoading}
                              aria-label="Marcar como anomalia técnica"
                              title="Anomalia técnica"
                              className="p-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-500 hover:text-white transition-colors"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onSetPendingStatus({ alertaId: alerta.id, novoStatus: "Falso_Positivo", label: "Falso Positivo" })}
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

      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0}
              aria-label="Página anterior"
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer touch-manipulation"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
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
  );
}
