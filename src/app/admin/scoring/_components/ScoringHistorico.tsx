"use client";

import { useState } from "react";
import { History, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { HistoricoRun } from "./types";

interface ScoringHistoricoProps {
  historico: HistoricoRun[];
  onLimpar: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-CV", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ScoringHistorico({ historico, onLimpar }: ScoringHistoricoProps) {
  const [show, setShow] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
      <button
        onClick={() => setShow((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-surface-container-low/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <History className="w-4 h-4 text-on-surface-variant" />
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Histórico</p>
            <p className="font-bold text-on-surface">Execuções Anteriores</p>
          </div>
          {historico.length > 0 && (
            <span className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant rounded-full text-[10px] font-bold">
              {historico.length}
            </span>
          )}
        </div>
        {show ? (
          <ChevronDown className="w-4 h-4 text-on-surface-variant" />
        ) : (
          <ChevronRight className="w-4 h-4 text-on-surface-variant" />
        )}
      </button>

      {show && (
        <>
          {historico.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-on-surface-variant text-center">
              Nenhuma execução registada
            </div>
          ) : (
            <>
              <div className="divide-y divide-surface-container-low">
                {historico.map((run) => (
                  <div key={run.id} className="px-6 py-4">
                    <button
                      onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                      className="w-full flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${run.sucesso ? "bg-emerald-500" : "bg-[#ba1a1a]"}`} />
                        <div>
                          <p className="text-xs font-bold text-on-surface">
                            {run.mes_ano} · {run.subestacao}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {formatDate(run.executado_em)} · {run.total_alertas} alertas · {(run.duracao_total_ms / 1000).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                      {expandedRun === run.id ? (
                        <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                      )}
                    </button>

                    {expandedRun === run.id && (
                      <div className="mt-3 rounded-xl overflow-hidden border border-outline-variant/20">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-surface-container-low/50 border-b border-surface-container-low">
                              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subestação</th>
                              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perda</th>
                              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zona</th>
                              <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alertas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-container-low">
                            {run.resultados.map((r) => (
                              <tr key={r.subestacao_id} className="hover:bg-surface-container-low/20">
                                <td className="px-4 py-2 font-bold text-on-surface">{r.nome}</td>
                                <td className="px-4 py-2">
                                  {r.error ? (
                                    <span className="text-[#ba1a1a]">{r.error}</span>
                                  ) : (
                                    <span className={parseFloat(r.perda_pct) >= 15 ? "text-[#ba1a1a] font-bold" : "text-on-surface-variant"}>
                                      {r.perda_pct}%
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                    r.zona_vermelha ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-emerald-100 text-emerald-700"
                                  }`}>
                                    {r.zona_vermelha ? "Vermelha" : "Verde"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-bold">
                                  {r.alertas_gerados > 0 ? (
                                    <span className="text-amber-600">{r.alertas_gerados}</span>
                                  ) : "0"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 border-t border-surface-container-low flex justify-end">
                <button
                  onClick={onLimpar}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-[#ba1a1a] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar histórico
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
