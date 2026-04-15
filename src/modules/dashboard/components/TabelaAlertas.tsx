"use client";

import { useState } from "react";
import { useAlertas } from "../hooks/useAlertas";
import { formatMesAno } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";
import { MessageSquare, ClipboardList, ChevronLeft, ChevronRight, RefreshCw, FileDown } from "lucide-react";
import { AlertaSheet, type AlertaSheetData } from "@/modules/alertas/components/AlertaSheet";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


interface TabelaAlertasProps {
  mesAno: string;
  zona?: string;
}

export function TabelaAlertas({ mesAno, zona }: TabelaAlertasProps) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alertaDetalhe, setAlertaDetalhe] = useState<AlertaSheetData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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

  async function handleEnviarSMS(alertaId: string) {
    const alerta = data.find((a) => a.id === alertaId);
    if (!alerta) return;
    setActionLoading(alertaId);
    const tipo = alerta.score_risco >= 75 ? "vermelho" : "amarelo";
    try {
      await enviarSMS(alertaId, tipo);
      await reload();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGerarOrdem(alertaId: string) {
    setActionLoading(alertaId);
    try {
      await gerarOrdem(alertaId);
      await reload();
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-surface-container-low">
        <div>
          <h3 className="font-bold text-lg text-on-surface">Alertas de Risco</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {total} alertas · {formatMesAno(mesAno)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setPage(0); }}
          >
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
          <button
            onClick={handleExportExcel}
            disabled={data.length === 0}
            aria-label="Exportar alertas para Excel"
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low disabled:opacity-40 cursor-pointer touch-manipulation transition-colors"
            title="Exportar Excel"
          >
            <FileDown className="w-4 h-4" />
          </button>
          <button
            onClick={reload}
            aria-label="Atualizar alertas"
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low cursor-pointer touch-manipulation transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabela */}
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
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-6 py-5">
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon={ClipboardList}
                    title="Nenhum alerta encontrado"
                    description="Tente ajustar os filtros selecionados"
                  />
                </td>
              </tr>
            ) : (
              data.map((alerta) => {
                const regrasPontuadas = alerta.motivo.filter((r) => r.pontos > 0);
                const isLoading = actionLoading === alerta.id;
                const podeEnviarSMS = alerta.status === "Pendente";
                const podeGerarOrdem =
                  alerta.status === "Pendente" ||
                  alerta.status === "Notificado_SMS";

                return (
                  <tr
                    key={alerta.id}
                    className="hover:bg-surface-container-low/30 transition-colors cursor-pointer"
                    onClick={() => { setAlertaDetalhe(alerta); setSheetOpen(true); }}
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
                        <button
                          onClick={() => { setAlertaDetalhe(alerta); setSheetOpen(true); }}
                          aria-label="Ver detalhes do alerta"
                          className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                          title="Ver detalhes"
                        >
                          Ver
                        </button>
                        {podeEnviarSMS && (
                          <button
                            onClick={() => handleEnviarSMS(alerta.id)}
                            disabled={isLoading || !alerta.cliente.telemovel}
                            title={
                              alerta.cliente.telemovel
                                ? "Enviar SMS"
                                : "Sem telemóvel registado"
                            }
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-container text-white rounded-full text-[10px] font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
                          >
                            <MessageSquare className="w-3 h-3" />
                            SMS
                          </button>
                        )}
                        {podeGerarOrdem && (
                          <button
                            onClick={() => handleGerarOrdem(alerta.id)}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-bold hover:bg-surface-container-highest disabled:opacity-40 transition-colors"
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

      <AlertaSheet
        alerta={alertaDetalhe}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEnviarSMS={handleEnviarSMS}
        onGerarOrdem={handleGerarOrdem}
        actionLoading={actionLoading}
      />
    </div>
  );
}
