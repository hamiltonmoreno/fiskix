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
    <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
      <div className="px-6 py-4 border-b border-surface-container-low flex items-center justify-between">
        <div>
          <p className="font-bold text-on-surface text-sm">{ficheiro?.name}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {preview.total} registos ·{" "}
            <span className="text-emerald-600">{preview.validos} válidos</span>
            {preview.erros_count > 0 && (
              <> · <span className="text-[#ba1a1a]">{preview.erros_count} erros</span></>
            )}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-bold text-on-surface-variant hover:text-on-surface cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <tbody className="divide-y divide-surface-container-low">
            {(preview.preview ?? []).slice(0, 6).map((row, i) => (
              <tr
                key={i}
                className={i === 0 ? "bg-surface-container-low/50" : "hover:bg-surface-container-low/20"}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-6 py-3 ${i === 0 ? "font-bold text-slate-400 uppercase tracking-widest text-[10px]" : "text-on-surface"}`}
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
        <div className="p-4 border-t border-surface-container-low bg-[#ffdad6]/20">
          <p className="text-xs font-bold text-[#ba1a1a] mb-2">Erros de validação</p>
          {(preview.erros ?? []).slice(0, 5).map((e, i) => (
            <p key={i} className="text-[11px] text-[#ba1a1a]/80 font-mono">
              Linha {e.linha} · {e.campo}: {e.motivo}
            </p>
          ))}
        </div>
      )}

      <div className="px-6 py-4 border-t border-surface-container-low flex justify-end">
        <button
          onClick={onImportar}
          disabled={preview.validos === 0 || loading}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-full font-bold text-xs transition-opacity cursor-pointer touch-manipulation"
        >
          Importar {preview.validos} registos válidos
        </button>
      </div>
    </div>
  );
}
