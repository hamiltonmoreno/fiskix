import { FileText } from "lucide-react";
import type { HistoricoItem } from "./types";

interface ImportHistoricoProps {
  historico: HistoricoItem[];
}

export function ImportHistorico({ historico }: ImportHistoricoProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700/60">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
          Histórico
        </p>
        <p className="font-bold text-gray-900 dark:text-gray-100">Importações Recentes</p>
      </div>

      {historico.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Nenhuma importação registada</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {historico.map((h) => (
            <div key={h.id} className="px-6 py-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex-1">{h.nome_ficheiro}</p>
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase flex-shrink-0 ${
                  h.tipo === "faturacao"
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                    : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                }`}>
                  {h.tipo === "faturacao" ? "Faturação" : "Injeção"}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-none">{h.total_registos} total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 leading-none">{h.registos_sucesso} ok</span>
                </div>
                {h.registos_erro > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span className="text-[11px] font-medium text-red-600 dark:text-red-400 leading-none">{h.registos_erro} erros</span>
                  </div>
                )}
                <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto tabular-nums font-mono">
                  {new Date(h.criado_em).toLocaleDateString("pt-CV")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
