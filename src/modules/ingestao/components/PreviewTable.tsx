import type { PreviewResult } from "./types";

interface PreviewTableProps {
  preview: PreviewResult;
  ficheiro: File | null;
  loading: boolean;
  onCancel: () => void;
  onImportar: () => void;
}

export function PreviewTable({ preview, ficheiro, loading, onCancel, onImportar }: PreviewTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{ficheiro?.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">{preview.total} registos</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{preview.validos} válidos</span>
            {preview.erros_count > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="text-xs text-red-600 dark:text-red-400 font-semibold">{preview.erros_count} erros</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/60">
              {preview.preview?.[0]?.map((head, i) => (
                <th key={i} className="px-6 py-3 font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {(preview.preview ?? []).slice(1, 6).map((row, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-6 py-3 text-gray-700 dark:text-gray-300"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(preview.erros ?? []).length > 0 && (
        <div className="p-6 border-t border-gray-100 dark:border-gray-700/60 bg-red-50/30 dark:bg-red-900/10">
          <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            Erros de validação (primeiros 5)
          </p>
          <div className="space-y-2">
            {(preview.erros ?? []).slice(0, 5).map((e, i) => (
              <p key={i} className="text-[11px] text-red-600/80 dark:text-red-400/80 font-mono leading-relaxed">
                <span className="font-bold">Linha {e.linha}:</span> {e.campo} &rarr; {e.motivo}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/30 dark:bg-gray-800/50 flex justify-end">
        <button
          onClick={onImportar}
          disabled={preview.validos === 0 || loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-sm shadow-blue-100 dark:shadow-none cursor-pointer"
        >
          {loading ? "A importar..." : `Importar ${preview.validos} registos válidos`}
        </button>
      </div>
    </div>
  );
}
