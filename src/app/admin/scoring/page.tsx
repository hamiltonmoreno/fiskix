"use client";

import { useState, useEffect, useMemo } from "react";
import { Play, CheckCircle, Loader2, History, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentMesAno } from "@/lib/utils";

interface Subestacao {
  id: string;
  nome: string;
  zona_bairro: string;
}

interface ResultadoScoring {
  subestacao_id: string;
  nome: string;
  perda_pct: string;
  zona_vermelha: boolean;
  alertas_gerados: number;
  duracao_ms: number;
  error?: string;
}

interface HistoricoRun {
  id: string;
  executado_em: string;
  mes_ano: string;
  subestacao: string;
  total_alertas: number;
  total_subestacoes: number;
  duracao_total_ms: number;
  resultados: ResultadoScoring[];
  sucesso: boolean;
}

const HISTORICO_KEY = "fiskix_scoring_historico";
const MAX_HISTORICO = 10;

function loadHistorico(): HistoricoRun[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORICO_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistorico(runs: HistoricoRun[]) {
  localStorage.setItem(HISTORICO_KEY, JSON.stringify(runs.slice(0, MAX_HISTORICO)));
}

export default function ScoringPage() {
  const [subestacoes, setSubestacoes] = useState<Subestacao[]>([]);
  const [mesAno, setMesAno] = useState(getCurrentMesAno());
  const [subSelecionada, setSubSelecionada] = useState<string>("todas");
  const [executando, setExecutando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoScoring[]>([]);
  const [historico, setHistorico] = useState<HistoricoRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from("subestacoes")
      .select("id, nome, zona_bairro")
      .eq("ativo", true)
      .then(({ data }) => setSubestacoes(data ?? []));
    setHistorico(loadHistorico());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function executarScoring() {
    setExecutando(true);
    setResultados([]);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const startTime = Date.now();

    const subsParaScoring =
      subSelecionada === "todas"
        ? subestacoes
        : subestacoes.filter((s) => s.id === subSelecionada);

    const novosResultados: ResultadoScoring[] = [];

    for (const sub of subsParaScoring) {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scoring-engine`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subestacao_id: sub.id, mes_ano: mesAno }),
        }
      );

      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      novosResultados.push({
        subestacao_id: sub.id,
        nome: sub.nome,
        perda_pct: data.perda_pct ?? "N/A",
        zona_vermelha: data.zona_vermelha ?? false,
        alertas_gerados: data.alertas_gerados ?? 0,
        duracao_ms: data.duracao_ms ?? 0,
        error: data.error,
      });

      setResultados([...novosResultados]);
    }

    const duracaoTotal = Date.now() - startTime;
    const run: HistoricoRun = {
      id: String(Date.now()),
      executado_em: new Date().toISOString(),
      mes_ano: mesAno,
      subestacao: subSelecionada === "todas"
        ? "Todas as subestações"
        : subestacoes.find((s) => s.id === subSelecionada)?.nome ?? subSelecionada,
      total_alertas: novosResultados.reduce((s, r) => s + (r.alertas_gerados ?? 0), 0),
      total_subestacoes: novosResultados.length,
      duracao_total_ms: duracaoTotal,
      resultados: novosResultados,
      sucesso: !novosResultados.some((r) => r.error),
    };

    const newHistorico = [run, ...historico].slice(0, MAX_HISTORICO);
    setHistorico(newHistorico);
    saveHistorico(newHistorico);
    setExecutando(false);
  }

  function handleLimparHistorico() {
    setHistorico([]);
    localStorage.removeItem(HISTORICO_KEY);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("pt-CV", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const totalAlertasAtual = resultados.reduce((s, r) => s + (r.alertas_gerados ?? 0), 0);

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">

      {/* Page hero */}
      <div className="mb-8">
        <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
          Administração · Engine
        </p>
        <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
          Motor de Scoring
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">
          9 Regras Graduais v2 · Execução manual ou cron automático
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">

        {/* Config card */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              Configuração
            </p>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  Mês / Ano
                </label>
                <input
                  type="month"
                  value={mesAno}
                  onChange={(e) => setMesAno(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  Subestação
                </label>
                <select
                  value={subSelecionada}
                  onChange={(e) => setSubSelecionada(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                >
                  <option value="todas">Todas as subestações</option>
                  {subestacoes.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={executarScoring}
              disabled={executando}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white rounded-full font-bold text-sm transition-opacity cursor-pointer touch-manipulation"
            >
              {executando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {executando ? "A calcular scores..." : "Executar Scoring"}
            </button>
          </div>
        </div>

        {/* Results + history */}
        <div className="col-span-12 lg:col-span-7 space-y-4">

          {/* Live results */}
          {resultados.length > 0 && (
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
                    Scoring concluído · {totalAlertasAtual} alertas gerados
                  </span>
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
            <button
              onClick={() => setShowHistorico((v) => !v)}
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
              {showHistorico ? (
                <ChevronDown className="w-4 h-4 text-on-surface-variant" />
              ) : (
                <ChevronRight className="w-4 h-4 text-on-surface-variant" />
              )}
            </button>

            {showHistorico && (
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
                        onClick={handleLimparHistorico}
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
        </div>
      </div>
    </div>
  );
}
