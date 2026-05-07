"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Brain, AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id_cliente: string;
  mes_ano: string;
  score_ml: number;
  modelo_versao: string;
  clientes: {
    nome_titular: string;
    numero_contador: string;
    subestacoes: { zona_bairro: string };
  };
};

function scoreColor(pct: number) {
  if (pct >= 80) return "text-red-600 font-semibold";
  if (pct >= 60) return "text-amber-600 font-semibold";
  return "text-blue-600 font-semibold";
}

const CARD =
  "bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-5";

export function PrevisaoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(0.6);
  const [mesAno, setMesAno] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data: predicoes } = await supabase
          .from("ml_predicoes")
          .select(
            "id_cliente, mes_ano, score_ml, modelo_versao, clientes!inner(nome_titular, numero_contador, subestacoes!inner(zona_bairro))"
          )
          .eq("mes_ano", mesAno)
          .gte("score_ml", minScore)
          .order("score_ml", { ascending: false })
          .limit(100);

        const clienteIds = (predicoes ?? []).map((p) => p.id_cliente);

        const { data: alertasExistentes } =
          clienteIds.length > 0
            ? await supabase
                .from("alertas_fraude")
                .select("id_cliente")
                .eq("mes_ano", mesAno)
                .in("id_cliente", clienteIds)
            : { data: [] };

        const comAlerta = new Set(
          (alertasExistentes ?? []).map((a) => a.id_cliente)
        );
        const semAlerta = (predicoes ?? []).filter(
          (p) => !comAlerta.has(p.id_cliente)
        ) as Row[];

        if (!cancelled) setRows(semAlerta);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [supabase, mesAno, minScore]);

  const totalPrevistos = rows.length;
  const avgScore =
    rows.length > 0
      ? ((rows.reduce((s, r) => s + r.score_ml, 0) / rows.length) * 100).toFixed(0)
      : "—";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Brain className="h-6 w-6 text-violet-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Previsão ML — Riscos Emergentes
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Período</label>
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Score mínimo</label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
          >
            {[0.5, 0.6, 0.7, 0.8].map((v) => (
              <option key={v} value={v}>
                {(v * 100).toFixed(0)}%
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={CARD}>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp className="h-4 w-4" /> Total previstos
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPrevistos}</p>
        </div>
        <div className={CARD}>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Sem alerta ativo
          </div>
          <p className="text-2xl font-bold text-amber-600">{totalPrevistos}</p>
        </div>
        <div className={CARD}>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Brain className="h-4 w-4 text-violet-500" /> Média score ML
          </div>
          <p className="text-2xl font-bold text-violet-600">{avgScore}{avgScore !== "—" ? "%" : ""}</p>
        </div>
      </div>

      {/* Table */}
      <div className={CARD + " p-0 overflow-hidden"}>
        {loading ? (
          <p className="p-6 text-sm text-gray-400">A carregar…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Nenhum risco emergente encontrado para os filtros selecionados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Contador</th>
                <th className="px-4 py-3 text-left">Zona</th>
                <th className="px-4 py-3 text-left">Score ML</th>
                <th className="px-4 py-3 text-left">Modelo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((r) => {
                const pct = Math.round(r.score_ml * 100);
                return (
                  <tr key={r.id_cliente} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {r.clientes.nome_titular}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {r.clientes.numero_contador}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {r.clientes.subestacoes.zona_bairro}
                    </td>
                    <td className={`px-4 py-3 ${scoreColor(pct)}`}>{pct}%</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.modelo_versao}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/clientes/${r.id_cliente}`}
                        className="inline-flex items-center gap-1 text-violet-600 hover:underline text-xs"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
