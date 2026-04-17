import { CheckCircle, AlertCircle } from "lucide-react";
import type { ImportResult } from "./types";

interface ImportResultadoProps {
  resultado: ImportResult;
  onReset: () => void;
}

export function ImportResultado({ resultado, onReset }: ImportResultadoProps) {
  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm p-6 border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-4">
        {resultado.erros === 0 ? (
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-[#ffdad6] flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[#ba1a1a]" />
          </div>
        )}
        <div>
          <p className="font-bold text-on-surface">Importação concluída</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            <span className="text-emerald-600">{resultado.sucesso} inseridos</span>
            {resultado.erros > 0 && (
              <> · <span className="text-[#ba1a1a]">{resultado.erros} erros</span></>
            )}
          </p>
        </div>
      </div>
      <button
        onClick={onReset}
        className="text-xs font-bold text-primary hover:underline cursor-pointer"
      >
        Importar mais dados
      </button>
    </div>
  );
}
