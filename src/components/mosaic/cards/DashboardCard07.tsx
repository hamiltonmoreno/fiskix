"use client";

import { useState } from "react";
import { useAlertas } from "@/modules/dashboard/hooks/useAlertas";
import { formatMesAno } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";
import { Icon } from "@/components/Icon";
import { AlertaSheet, type AlertaSheetData } from "@/modules/alertas/components/AlertaSheet";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { toast } from "sonner";

interface DashboardCard07Props {
  mesAno: string;
  zona?: string;
}

export function DashboardCard07({ mesAno, zona }: DashboardCard07Props) {
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
    haptics.medium();
    setActionLoading(alertaId);
    const tipo = alerta.score_risco >= 75 ? "vermelho" : "amarelo";
    try {
      await enviarSMS(alertaId, tipo);
      await reload();
    } catch {
      toast.error("Erro ao enviar SMS. Tente novamente.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGerarOrdem(alertaId: string) {
    haptics.medium();
    setActionLoading(alertaId);
    try {
      await gerarOrdem(alertaId);
      await reload();
    } catch {
      toast.error("Erro ao gerar ordem de inspeção. Tente novamente.");
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="col-span-full bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/60">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Alertas de Risco</h2>
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
            {total} alertas · {formatMesAno(mesAno)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Simple select instead of Shadcn select for Mosaic aesthetic match */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="pl-3 pr-8 py-1.5 text-xs font-medium bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700/60 rounded-lg focus:ring-primary focus:border-primary text-gray-600 dark:text-gray-300 transition-colors"
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
            className="p-1.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40"
            title="Exportar Excel"
          >
            <Icon name="download" size="xs" />
          </button>
          <button
            onClick={reload}
            className="p-1.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm text-gray-500 dark:text-gray-400 transition-colors"
            title="Atualizar"
          >
            <Icon name="refresh" size="xs" />
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto mosaic-scrollbar">
        <table className="w-full text-sm text-left align-middle border-collapse">
          <thead className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/20 uppercase">
            <tr className="border-b border-gray-100 dark:border-gray-700/60">
              <th className="px-5 py-3 font-semibold whitespace-nowrap">Score</th>
              <th className="px-5 py-3 font-semibold whitespace-nowrap">Contador</th>
              <th className="px-5 py-3 font-semibold whitespace-nowrap">Titular & Zona</th>
              <th className="px-5 py-3 font-semibold whitespace-nowrap hidden sm:table-cell">Regras</th>
              <th className="px-5 py-3 font-semibold whitespace-nowrap">Estado</th>
              <th className="px-5 py-3 font-semibold whitespace-nowrap text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  <Icon name="assignment" size="sm" className="mx-auto mb-2 opacity-50" />
                  Nenhum alerta encontrado
                </td>
              </tr>
            ) : (
              data.map((alerta) => {
                const regrasPontuadas = alerta.motivo.filter((r) => r.pontos > 0);
                const isLoading = actionLoading === alerta.id;
                const podeEnviarSMS = alerta.status === "Pendente";
                const podeGerarOrdem = alerta.status === "Pendente" || alerta.status === "Notificado_SMS";

                return (
                  <tr
                    key={alerta.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors cursor-pointer group"
                    onClick={() => { setAlertaDetalhe(alerta); setSheetOpen(true); }}
                  >
                    <td className="px-5 py-4">
                      <ScoreBadge score={alerta.score_risco} showScore />
                    </td>
                    <td className="px-5 py-4 font-mono font-medium text-primary">
                      {alerta.cliente.numero_contador}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-800 dark:text-gray-100">{alerta.cliente.nome_titular}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{alerta.subestacao.zona_bairro.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {regrasPontuadas.slice(0, 3).map((r) => (
                          <span
                            key={r.regra}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px] font-mono font-semibold"
                            title={r.descricao}
                          >
                            {r.regra}
                          </span>
                        ))}
                        {regrasPontuadas.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded text-[10px]">
                            +{regrasPontuadas.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={(alerta.status === "Inspecionado" && alerta.resultado) ? alerta.resultado : alerta.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {podeEnviarSMS && (
                          <button
                            onClick={() => handleEnviarSMS(alerta.id)}
                            disabled={isLoading || !alerta.cliente.telemovel}
                            className="bg-primary hover:bg-primary/90 text-white rounded px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                          >
                            SMS
                          </button>
                        )}
                        {podeGerarOrdem && (
                          <button
                            onClick={() => handleGerarOrdem(alerta.id)}
                            disabled={isLoading}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300 rounded px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                          >
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
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mostrando <span className="font-semibold text-gray-800 dark:text-gray-100">{page * pageSize + 1}</span> a <span className="font-semibold text-gray-800 dark:text-gray-100">{Math.min((page + 1) * pageSize, total)}</span> de <span className="font-semibold text-gray-800 dark:text-gray-100">{total}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Icon name="chevron_left" size="xs" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Icon name="chevron_right" size="xs" />
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
