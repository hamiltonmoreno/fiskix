"use client";

import { useState, useEffect } from "react";
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
  id: string; // timestamp as string
  executado_em: string; // ISO string
  mes_ano: string;
  subestacao: string; // "todas" or nome
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
  const supabase = createClient();

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="font-bold text-slate-900">Motor de Scoring</h1>
        <p className="text-sm text-slate-400">9 Regras Graduais v2</p>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Configuração */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="font-semibold text-slate-700 mb-4">Configuração</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">Mês / Ano</label>
              <input
                type="month"
                value={mesAno}
                onChange={(e) => setMesAno(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">Subestação</label>
              <select
                value={subSelecionada}
                onChange={(e) => setSubSelecionada(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todas">Todas as subestações</option>
                {subestacoes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={executarScoring}
            disabled={executando}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {executando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {executando ? "A calcular scores..." : "Executar Scoring"}
          </button>
        </div>

        {/* Resultados da execução atual */}
        {resultados.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-semibold text-slate-700">Resultados — {mesAno}</p>
              {executando && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Em curso...
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Subestação</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Perda</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Zona</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Alertas</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Duração</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => (
                  <tr key={r.subestacao_id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{r.nome}</td>
                    <td className="px-4 py-3">
                      {r.error ? (
                        <span className="text-red-500 text-xs">{r.error}</span>
                      ) : (
                        <span className={parseFloat(r.perda_pct) >= 15 ? "text-red-600 font-bold" : "text-slate-600"}>
                          {r.perda_pct}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.zona_vermelha ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}>
                        {r.zona_vermelha ? "Vermelha" : "Verde"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.alertas_gerados > 0 ? (
                        <span className="text-amber-600">{r.alertas_gerados}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.duracao_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!executando && resultados.every((r) => !r.error) && (
              <div className="p-4 border-t border-slate-100 flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Scoring concluído · {resultados.reduce((s, r) => s + (r.alertas_gerados ?? 0), 0)} alertas gerados
                </span>
              </div>
            )}
          </div>
        )}

        {/* Histórico de execuções */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowHistorico((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">Histórico de Execuções</span>
              {historico.length > 0 && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                  {historico.length}
                </span>
              )}
            </div>
            {showHistorico ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showHistorico && (
            <>
              {historico.length === 0 ? (
                <div className="px-4 pb-5 text-sm text-slate-400 text-center">
                  Nenhuma execução registada nesta sessão
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {historico.map((run) => (
                      <div key={run.id} className="px-4 py-3">
                        <button
                          onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                          className="w-full flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${run.sucesso ? "bg-green-500" : "bg-red-500"}`} />
                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                {run.mes_ano} · {run.subestacao}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatDate(run.executado_em)} · {run.total_alertas} alertas · {(run.duracao_total_ms / 1000).toFixed(1)}s
                              </p>
                            </div>
                          </div>
                          {expandedRun === run.id ? (
                            <ChevronDown className="w-4 h-4 text-slate-300" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          )}
                        </button>

                        {expandedRun === run.id && (
                          <div className="mt-3 rounded-lg overflow-hidden border border-slate-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="text-left px-3 py-2 font-medium text-slate-500">Subestação</th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-500">Perda</th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-500">Zona</th>
                                  <th className="text-right px-3 py-2 font-medium text-slate-500">Alertas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {run.resultados.map((r) => (
                                  <tr key={r.subestacao_id} className="border-b border-slate-50 last:border-0">
                                    <td className="px-3 py-2 text-slate-700">{r.nome}</td>
                                    <td className="px-3 py-2">
                                      {r.error ? (
                                        <span className="text-red-500">{r.error}</span>
                                      ) : (
                                        <span className={parseFloat(r.perda_pct) >= 15 ? "text-red-600 font-bold" : "text-slate-600"}>
                                          {r.perda_pct}%
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                                        r.zona_vermelha ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                      }`}>
                                        {r.zona_vermelha ? "Vermelha" : "Verde"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">
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
                  <div className="p-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={handleLimparHistorico}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
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
      </main>
    </div>
  );
}
