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

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">
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
