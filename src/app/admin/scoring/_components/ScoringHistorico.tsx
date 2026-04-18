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

import { History, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { HistoricoRun } from "./types";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";

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

  const toggleShow = () => {
    haptics.light();
    setShow(!show);
  };

  const toggleRun = (id: string) => {
    haptics.light();
    setExpandedRun(expandedRun === id ? null : id);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700/60 transition-all duration-300">
      <button
        onClick={toggleShow}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <History className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Cópia de Segurança</p>
            <p className="font-bold text-gray-900 dark:text-gray-100">Histórico de Execuções</p>
          </div>
          {historico.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-[10px] font-bold border border-gray-200 dark:border-gray-600">
              {historico.length}
            </span>
          )}
        </div>
        {show ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {show && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          {historico.length === 0 ? (
            <div className="px-6 pb-8 text-sm text-gray-500 dark:text-gray-400 text-center italic">
              Nenhum registo de execução encontrado.
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {historico.map((run) => (
                  <div key={run.id} className="group">
                    <button
                      onClick={() => toggleRun(run.id)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${run.sucesso ? "bg-emerald-500 shadow-sm shadow-emerald-200" : "bg-red-500 shadow-sm shadow-red-200"}`} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {run.mes_ano} · {run.subestacao}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
                            {formatDate(run.executado_em)} · <span className="text-amber-600 dark:text-amber-500">{run.total_alertas} alertas</span> · {(run.duracao_total_ms / 1000).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                      {expandedRun === run.id ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {expandedRun === run.id && (
                      <div className="px-6 pb-5 animate-in slide-in-from-top-2 duration-200">
                        <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/30">
                          <table className="w-full text-[11px] text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                                <th className="px-4 py-2 font-bold text-gray-400 uppercase tracking-widest text-[9px]">Subestação</th>
                                <th className="px-4 py-2 font-bold text-gray-400 uppercase tracking-widest text-[9px]">Perda</th>
                                <th className="px-4 py-2 font-bold text-gray-400 uppercase tracking-widest text-[9px]">Zona</th>
                                <th className="px-4 py-2 font-bold text-gray-400 uppercase tracking-widest text-[9px] text-right">Alertas</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {run.resultados.map((r) => (
                                <tr key={r.subestacao_id} className="hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                  <td className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300">{r.nome}</td>
                                  <td className="px-4 py-2.5">
                                    {r.error ? (
                                      <span className="text-red-600 dark:text-red-400 font-bold">{r.error}</span>
                                    ) : (
                                      <span className={parseFloat(r.perda_pct) >= 15 ? "text-red-600 dark:text-red-400 font-bold" : "text-gray-600"}>
                                        {r.perda_pct}%
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                      r.zona_vermelha ? "bg-red-50 dark:bg-red-500/10 text-red-600 border-red-100" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-100"
                                    }`}>
                                      {r.zona_vermelha ? "Crit" : "Vrd"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100">
                                    {r.alertas_gerados > 0 ? (
                                      <span className="text-amber-600 dark:text-amber-500">{r.alertas_gerados}</span>
                                    ) : "0"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/20 flex justify-end">
                <button
                  onClick={() => { haptics.notification("warning"); onLimpar(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer rounded-md hover:bg-red-50 dark:hover:bg-red-900/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  LIMPAR HISTÓRICO
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
