"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { RepeatIcon, AlertTriangle } from "lucide-react";

interface AlertaRaw {
  id: string;
  id_cliente: string;
  mes_ano: string;
  score_risco: number;
  resultado: string | null;
  clientes: { nome_titular: string; numero_contador: string; subestacoes: { zona_bairro: string } };
}

interface ClienteReincidente {
  id: string;
  nome: string;
  contador: string;
  zona: string;
  totalAlertas: number;
  confirmados: number;
  scoreMax: number;
  ultimoMes: string;
}

export function ReincidenciaClient() {
  const supabase = useMemo(() => createClient(), []);
  const [alertas, setAlertas] = useState<AlertaRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [minConfirmados, setMinConfirmados] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("alertas_fraude")
          .select("id, id_cliente, mes_ano, score_risco, resultado, clientes!inner(nome_titular, numero_contador, subestacoes!inner(zona_bairro))")
          .in("resultado", ["Fraude_Confirmada", "Anomalia_Tecnica"])
          .order("mes_ano", { ascending: false });
        setAlertas((data ?? []) as unknown as AlertaRaw[]);
      } finally { setLoading(false); }
    })();
  }, [supabase]);

  const reincidentes: ClienteReincidente[] = useMemo(() => {
    const map = new Map<string, AlertaRaw[]>();
    for (const a of alertas) {
      const list = map.get(a.id_cliente) ?? [];
      list.push(a);
      map.set(a.id_cliente, list);
    }

    return [...map.entries()]
      .map(([id, list]) => {
        const confirmados = list.filter((a) => a.resultado === "Fraude_Confirmada").length;
        return {
          id,
          nome: list[0].clientes.nome_titular,
          contador: list[0].clientes.numero_contador,
          zona: list[0].clientes.subestacoes.zona_bairro,
          totalAlertas: list.length,
          confirmados,
          scoreMax: Math.max(...list.map((a) => a.score_risco)),
          ultimoMes: list[0].mes_ano,
        };
      })
      .filter((c) => c.confirmados >= minConfirmados)
      .sort((a, b) => b.confirmados - a.confirmados || b.scoreMax - a.scoreMax);
  }, [alertas, minConfirmados]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Análise de Reincidência</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Clientes com múltiplas fraudes ou anomalias confirmadas</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500 dark:text-gray-400">Mín. confirmados:</label>
          <select value={minConfirmados} onChange={(e) => setMinConfirmados(Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm">
            {[1, 2, 3].map((v) => <option key={v} value={v}>{v}+</option>)}
          </select>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Clientes reincidentes</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{reincidentes.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Total confirmações</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">
            {reincidentes.reduce((s, c) => s + c.confirmados, 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Score máximo registado</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {reincidentes.length ? Math.max(...reincidentes.map((c) => c.scoreMax)) : "—"} pts
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        {loading ? (
          <div className="h-40 bg-slate-50 dark:bg-gray-900/40 animate-pulse" />
        ) : reincidentes.length === 0 ? (
          <div className="p-12 text-center">
            <RepeatIcon className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-gray-400">Nenhum cliente reincidente com os filtros atuais.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Zona</th>
                  <th className="px-4 py-3 text-right font-medium">Confirmados</th>
                  <th className="px-4 py-3 text-right font-medium">Total alertas</th>
                  <th className="px-4 py-3 text-right font-medium">Score máx.</th>
                  <th className="px-4 py-3 text-left font-medium">Último mês</th>
                  <th className="px-4 py-3 text-center font-medium">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                {reincidentes.map((c) => (
                  <tr key={c.id} className="hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-gray-100">{c.nome}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">{c.contador}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{c.zona.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-red-600 dark:text-red-400">{c.confirmados}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300">{c.totalAlertas}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-red-600 dark:text-red-400">
                      {c.scoreMax} pts
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 font-mono text-xs">{c.ultimoMes}</td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/clientes/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        <AlertTriangle className="w-3 h-3" /> Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
