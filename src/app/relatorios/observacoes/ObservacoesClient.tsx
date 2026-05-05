"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Search, FileText, BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Row = {
  id: string;
  observacoes: string | null;
  resultado: string | null;
  tipo_fraude: string | null;
  criado_em: string;
  alertas_fraude: {
    mes_ano: string;
    clientes: { nome_titular: string; numero_contador: string };
  };
};

const STOP_WORDS = new Set([
  "de", "a", "o", "e", "do", "da", "em", "no", "na", "com", "por", "que", "um", "uma",
]);

const RESULTADO_COLORS: Record<string, string> = {
  Fraude_Confirmada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Anomalia_Tecnica: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Sem_Anomalia: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Inconclusivo: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function ObservacoesClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resultadoFiltro, setResultadoFiltro] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("relatorios_inspecao")
          .select(
            "id, observacoes, resultado, tipo_fraude, criado_em, alertas_fraude!inner(mes_ano, clientes!inner(nome_titular, numero_contador))"
          )
          .not("observacoes", "is", null)
          .neq("observacoes", "")
          .order("criado_em", { ascending: false });
        setRows((data as Row[]) ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const wordFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const row of rows) {
      const words = (row.observacoes ?? "").toLowerCase().split(/\s+/);
      for (const w of words) {
        const clean = w.replace(/[^a-záéíóúãõâêîôûç]/gi, "");
        if (clean.length > 3 && !STOP_WORDS.has(clean))
          freq[clean] = (freq[clean] ?? 0) + 1;
      }
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [rows]);

  const totalSem = useMemo(async () => {
    const { count } = await supabase
      .from("relatorios_inspecao")
      .select("id", { count: "exact", head: true })
      .or("observacoes.is.null,observacoes.eq.");
    return count ?? 0;
  }, [supabase]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch = search
        ? (r.observacoes ?? "").toLowerCase().includes(search.toLowerCase())
        : true;
      const matchResultado = resultadoFiltro ? r.resultado === resultadoFiltro : true;
      return matchSearch && matchResultado;
    });
  }, [rows, search, resultadoFiltro]);

  const resultados = useMemo(
    () => Array.from(new Set(rows.map((r) => r.resultado).filter(Boolean))),
    [rows]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        A carregar observações...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-500" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Análise de Observações
        </h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Com observação" value={rows.length} />
        <KpiCard label="Total palavras únicas" value={wordFreq.length > 0 ? Object.keys(Object.fromEntries(wordFreq)).length : 0} />
        <KpiCard label="Resultados distintos" value={resultados.length} />
      </div>

      {/* Word frequency chart */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Top 20 palavras mais frequentes
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={wordFreq.map(([word, count]) => ({ word, count }))} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="word" width={110} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar observações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={resultadoFiltro}
          onChange={(e) => setResultadoFiltro(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os resultados</option>
          {resultados.map((r) => (
            <option key={r} value={r ?? ""}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {filtered.length} observações
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-left">Contador</th>
                <th className="px-4 py-2 text-left">Resultado</th>
                <th className="px-4 py-2 text-left">Tipo fraude</th>
                <th className="px-4 py-2 text-left">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {new Date(r.criado_em).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-200 max-w-[140px] truncate">
                    {r.alertas_fraude?.clientes?.nome_titular ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 font-mono">
                    {r.alertas_fraude?.clientes?.numero_contador ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {r.resultado ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESULTADO_COLORS[r.resultado] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {r.resultado.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {r.tipo_fraude ?? "—"}
                  </td>
                  <td
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-[260px] truncate cursor-default"
                    title={r.observacoes ?? ""}
                  >
                    {(r.observacoes ?? "").slice(0, 100)}
                    {(r.observacoes ?? "").length > 100 ? "…" : ""}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma observação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
