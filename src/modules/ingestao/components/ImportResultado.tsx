import { CheckCircle, AlertCircle } from "lucide-react";
import type { ImportResult } from "./types";
import { haptics } from "@/lib/haptics";

interface ImportResultadoProps {
  resultado: ImportResult;
  onReset: () => void;
}

export function ImportResultado({ resultado, onReset }: ImportResultadoProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700/60 transition-all duration-300">
      <div className="flex items-center gap-4 mb-5">
        {resultado.erros === 0 ? (
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center border border-red-100 dark:border-red-500/20">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
        )}
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">Importação concluída</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{resultado.sucesso} inseridos</span>
            {resultado.erros > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">{resultado.erros} erros</span>
              </>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => { haptics.light(); onReset(); }}
        className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer"
      >
        Importar mais dados
      </button>
    </div>
  );
}
