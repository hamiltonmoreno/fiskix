"use client";

import { MessageSquare, ClipboardList, Download, X } from "lucide-react";
import { haptics } from "@/lib/haptics";

interface AlertasBulkBarProps {
  selectedCount: number;
  smsEligibleCount: number;
  ordemEligibleCount: number;
  busy: boolean;
  onClear: () => void;
  onBulkSMS: () => void;
  onBulkOrdem: () => void;
  onBulkExport: () => void;
}

export function AlertasBulkBar({
  selectedCount,
  smsEligibleCount,
  ordemEligibleCount,
  busy,
  onClear,
  onBulkSMS,
  onBulkOrdem,
  onBulkExport,
}: AlertasBulkBarProps) {
  if (selectedCount === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Acções em massa"
      className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/95 dark:border-blue-700/50 dark:bg-blue-950/60 backdrop-blur px-4 py-2.5 shadow-sm"
    >
      <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
        {selectedCount} selecionado{selectedCount === 1 ? "" : "s"}
      </span>
      <span className="hidden sm:inline-block h-4 w-px bg-blue-200 dark:bg-blue-700/50" />
      <button
        onClick={() => { haptics.medium(); onBulkSMS(); }}
        disabled={busy || smsEligibleCount === 0}
        title={smsEligibleCount === 0 ? "Nenhum dos selecionados é elegível para SMS" : `Enviar SMS para ${smsEligibleCount}`}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        SMS ({smsEligibleCount})
      </button>
      <button
        onClick={() => { haptics.medium(); onBulkOrdem(); }}
        disabled={busy || ordemEligibleCount === 0}
        title={ordemEligibleCount === 0 ? "Nenhum dos selecionados é elegível" : `Gerar ordens (${ordemEligibleCount})`}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm"
      >
        <ClipboardList className="w-3.5 h-3.5" />
        Ordem ({ordemEligibleCount})
      </button>
      <button
        onClick={() => { haptics.light(); onBulkExport(); }}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm"
      >
        <Download className="w-3.5 h-3.5" />
        Exportar
      </button>
      <button
        onClick={() => { haptics.light(); onClear(); }}
        aria-label="Limpar seleção"
        className="ml-auto flex items-center gap-1 px-2 py-1.5 text-blue-900/70 dark:text-blue-100/70 hover:text-blue-900 dark:hover:text-blue-100 text-xs font-medium"
      >
        <X className="w-4 h-4" />
        Limpar
      </button>
    </div>
  );
}
