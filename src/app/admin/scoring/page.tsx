"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentMesAno } from "@/lib/utils";
import type { Subestacao, ResultadoScoring, HistoricoRun } from "./_components/types";
import { HISTORICO_KEY, MAX_HISTORICO, loadHistorico, saveHistorico } from "./_components/scoring-storage";
import { ScoringConfigCard } from "./_components/ScoringConfigCard";
import { ScoringResultsTable } from "./_components/ScoringResultsTable";
import { ScoringHistorico } from "./_components/ScoringHistorico";

export default function ScoringPage() {
  const [subestacoes, setSubestacoes] = useState<Subestacao[]>([]);
  const [mesAno, setMesAno] = useState(getCurrentMesAno());
  const [subSelecionada, setSubSelecionada] = useState<string>("todas");
  const [executando, setExecutando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoScoring[]>([]);
  const [historico, setHistorico] = useState<HistoricoRun[]>([]);
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
    try {
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
        subestacao:
          subSelecionada === "todas"
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
    } finally {
      setExecutando(false);
    }
  }

  function handleLimparHistorico() {
    setHistorico([]);
    localStorage.removeItem(HISTORICO_KEY);
  }

  const RULES = [
    { id: "R1", label: "Queda súbita",        desc: "Queda vs média 6 meses",         pts: "0–25", color: "text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400" },
    { id: "R2", label: "Consumo constante",    desc: "CV anormalmente baixo",           pts: "0–15", color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400" },
    { id: "R3", label: "Desvio de cluster",    desc: "Desvio face à tarifa",            pts: "0–20", color: "text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400" },
    { id: "R4", label: "Divergência sazonal",  desc: "Cliente vs subestação",           pts: "0–15", color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10 dark:text-yellow-400" },
    { id: "R5", label: "Slow bleed",           desc: "Tendência descend. 3+ meses",     pts: "0–10", color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400" },
    { id: "R6", label: "Rácio CVE/kWh",        desc: "Desvio padrão anómalo",           pts: "0–5",  color: "text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400" },
    { id: "R7", label: "Reincidência",         desc: "Alertas confirmados 12 meses",    pts: "+5",   color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400" },
    { id: "R8", label: "Pico histórico",       desc: "Consumo < 20% do pico",           pts: "0–5",  color: "text-teal-600 bg-teal-50 dark:bg-teal-500/10 dark:text-teal-400" },
    { id: "R9", label: "Zona vermelha",        desc: "Multiplicador se perda > 15%",    pts: "×1.3", color: "text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-300" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 w-full max-w-9xl mx-auto space-y-6">

      {/* ── Barra de estado: regras + limiares + cron ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {RULES.map((r) => (
            <span
              key={r.id}
              title={`${r.label} — ${r.desc} · ${r.pts} pts`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold cursor-default ${r.color}`}
            >
              {r.id}
              <span className="font-normal opacity-60 text-[10px]">{r.pts}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />≥ 50 Médio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />≥ 75 Crítico
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Cron ativo · dia 1 às 02:00 UTC
          </span>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <ScoringConfigCard
            subestacoes={subestacoes}
            mesAno={mesAno}
            onMesAnoChange={setMesAno}
            subSelecionada={subSelecionada}
            onSubChange={setSubSelecionada}
            executando={executando}
            onExecutar={executarScoring}
          />
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-4">
          <ScoringResultsTable
            resultados={resultados}
            mesAno={mesAno}
            executando={executando}
          />
          <ScoringHistorico
            historico={historico}
            onLimpar={handleLimparHistorico}
          />
        </div>
      </div>
    </div>
  );
}
