import { FileText } from "lucide-react";
import type { HistoricoItem } from "./types";

interface ImportHistoricoProps {
  historico: HistoricoItem[];
}

export function ImportHistorico({ historico }: ImportHistoricoProps) {
  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
      <div className="px-6 py-5 border-b border-surface-container-low">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
          Histórico
        </p>
        <p className="font-bold text-on-surface">Importações Recentes</p>
      </div>

      {historico.length === 0 ? (
        <div className="p-10 text-center">
          <FileText className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant">Nenhuma importação ainda</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-container-low">
          {historico.map((h) => (
            <div key={h.id} className="px-6 py-4 hover:bg-surface-container-low/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-on-surface truncate flex-1">{h.nome_ficheiro}</p>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase flex-shrink-0 ${
                  h.tipo === "faturacao"
                    ? "bg-primary/10 text-primary"
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  {h.tipo}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-on-surface-variant">{h.total_registos} total</span>
                <span className="text-[11px] text-emerald-600">{h.registos_sucesso} ok</span>
                {h.registos_erro > 0 && (
                  <span className="text-[11px] text-[#ba1a1a]">{h.registos_erro} erros</span>
                )}
                <span className="text-[11px] text-on-surface-variant ml-auto tabular-nums">
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
