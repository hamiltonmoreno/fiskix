import { Loader2, CheckCircle } from "lucide-react";
import type { ResultadoScoring } from "./types";

interface ScoringResultsTableProps {
  resultados: ResultadoScoring[];
  mesAno: string;
  executando: boolean;
}

export function ScoringResultsTable({ resultados, mesAno, executando }: ScoringResultsTableProps) {
  if (resultados.length === 0) return null;

  const total = resultados.reduce((s, r) => s + (r.alertas_gerados ?? 0), 0);

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden transition-all duration-300">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
            Resultados da Execução
          </p>
          <p className="font-bold text-gray-900 dark:text-gray-100">{mesAno}</p>
        </div>
        {executando && (
          <span className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 animate-pulse bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Em processamento...
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/60">
              <th className="px-6 py-3 font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">Subestação</th>
              <th className="px-6 py-3 font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">Perda</th>
              <th className="px-6 py-3 font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">Zona</th>
              <th className="px-6 py-3 font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">Alertas</th>
              <th className="px-6 py-3 font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[10px]">Tempo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {resultados.map((r) => (
              <tr key={r.subestacao_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100 text-xs">{r.nome}</td>
                <td className="px-6 py-4 text-xs font-mono">
                  {r.error ? (
                    <span className="text-red-600 dark:text-red-400 font-bold">{r.error}</span>
                  ) : (
                    <span className={parseFloat(r.perda_pct) >= 15 ? "text-red-600 dark:text-red-400 font-bold" : "text-gray-600 dark:text-gray-400"}>
                      {r.perda_pct}%
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                    r.zona_vermelha ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                  }`}>
                    {r.zona_vermelha ? "Crítica" : "Normal"}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs font-bold">
                  {r.alertas_gerados > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">{r.alertas_gerados}</span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600">0</span>
                  )}
                </td>
                <td className="px-6 py-4 text-[11px] text-gray-400 dark:text-gray-500 font-mono italic">{r.duracao_ms}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!executando && resultados.every((r) => !r.error) && (
        <div className="px-6 py-5 border-t border-gray-100 dark:border-gray-700/60 bg-emerald-50/30 dark:bg-emerald-500/10 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-bold">
            Scoring concluído com sucesso · {total} alertas gerados para {mesAno}
          </span>
        </div>
      )}
    </div>
  );
}
