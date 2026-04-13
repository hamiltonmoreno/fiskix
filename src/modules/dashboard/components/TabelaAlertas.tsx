"use client";

import { useState } from "react";
import { useAlertas } from "../hooks/useAlertas";
import { formatMesAno } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";
import { MessageSquare, ClipboardList, ChevronLeft, ChevronRight, RefreshCw, Eye, FileDown } from "lucide-react";
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
    <div className="bg-card rounded-xl border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Alertas de Risco</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} alertas · {formatMesAno(mesAno)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setPage(0); }}
          >
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
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
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer touch-manipulation"
            title="Exportar Excel"
          >
            <FileDown className="w-4 h-4" />
          </button>
          <button
            onClick={reload}
            aria-label="Atualizar alertas"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer touch-manipulation"
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
                      <Skeleton className="h-4 w-full" />
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
                    className="border-b border-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => { setAlertaDetalhe(alerta); setSheetOpen(true); }}
                  >
                    <td className="px-4 py-3">
                      <ScoreBadge score={alerta.score_risco} showScore />
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
                      <StatusBadge status={(alerta.status === "Inspecionado" && alerta.resultado) ? alerta.resultado : alerta.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setAlertaDetalhe(alerta); setSheetOpen(true); }}
                          aria-label="Ver detalhes do alerta"
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" />
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
