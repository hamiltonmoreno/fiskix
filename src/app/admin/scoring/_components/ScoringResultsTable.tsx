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
    <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
      <div className="px-6 py-5 border-b border-surface-container-low flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
            Resultados
          </p>
          <p className="font-bold text-on-surface">{mesAno}</p>
        </div>
        {executando && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Em curso...
          </span>
        )}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-container-low/50 border-b border-surface-container-low">
            <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-left">Subestação</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-left">Perda</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-left">Zona</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-left">Alertas</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-left">ms</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-low">
          {resultados.map((r) => (
            <tr key={r.subestacao_id} className="hover:bg-surface-container-low/20 transition-colors">
              <td className="px-6 py-4 font-bold text-on-surface text-xs">{r.nome}</td>
              <td className="px-6 py-4 text-xs">
                {r.error ? (
                  <span className="text-[#ba1a1a] font-mono">{r.error}</span>
                ) : (
                  <span className={parseFloat(r.perda_pct) >= 15 ? "text-[#ba1a1a] font-bold" : "text-on-surface-variant"}>
                    {r.perda_pct}%
                  </span>
                )}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  r.zona_vermelha ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {r.zona_vermelha ? "Vermelha" : "Verde"}
                </span>
              </td>
              <td className="px-6 py-4 text-xs font-bold">
                {r.alertas_gerados > 0 ? (
                  <span className="text-amber-600">{r.alertas_gerados}</span>
                ) : (
                  <span className="text-on-surface-variant">0</span>
                )}
              </td>
              <td className="px-6 py-4 text-[11px] text-on-surface-variant font-mono">{r.duracao_ms}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!executando && resultados.every((r) => !r.error) && (
        <div className="px-6 py-4 border-t border-surface-container-low flex items-center gap-2 text-emerald-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs font-bold">
            Scoring concluído · {total} alertas gerados
          </span>
        </div>
      )}
    </div>
  );
}
