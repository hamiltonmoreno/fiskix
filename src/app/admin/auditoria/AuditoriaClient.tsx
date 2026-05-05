"use client";

import { useEffect, useMemo, useState } from "react";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AuditRow {
  id: string;
  chave: string;
  operacao: string;
  valor_antes: string | null;
  valor_depois: string | null;
  usuario_id: string;
  usuario_role: string;
  criado_em: string;
}

const PAGE_SIZE = 30;

const ROLE_LABELS: Record<string, string> = {
  admin_fiskix:  "Administrador",
  gestor_perdas: "Gestor de Perdas",
  diretor:       "Diretor",
  supervisor:    "Supervisor",
  fiscal:        "Fiscal",
};

const OP_STYLES: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
};

export function AuditoriaClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filtroChave, setFiltroChave] = useState("");
  const [chaves, setChaves] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("configuracoes_audit")
      .select("chave")
      .then(({ data }) => {
        if (data) setChaves([...new Set(data.map((r) => r.chave))].sort());
      });
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("configuracoes_audit")
          .select("*", { count: "exact" })
          .order("criado_em", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (filtroChave) q = q.eq("chave", filtroChave);

        const { data, count } = await q;
        setRows((data ?? []) as AuditRow[]);
        setTotal(count ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, filtroChave, supabase]);

  useEffect(() => { setPage(0); }, [filtroChave]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Auditoria de Configurações
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Histórico de alterações aos thresholds do motor de scoring
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
          <History className="w-4 h-4" />
          <span>{total} registos</span>
        </div>
      </div>

      {/* Filtro */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 mb-6">
        <select
          value={filtroChave}
          onChange={(e) => setFiltroChave(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as configurações</option>
          {chaves.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        {loading ? (
          <div className="h-40 bg-slate-50 dark:bg-gray-900/40 animate-pulse" />
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-gray-400">Nenhum registo de auditoria encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data / Hora</th>
                  <th className="px-4 py-3 text-left font-medium">Configuração</th>
                  <th className="px-4 py-3 text-left font-medium">Operação</th>
                  <th className="px-4 py-3 text-right font-medium">Antes</th>
                  <th className="px-4 py-3 text-right font-medium">Depois</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {new Date(r.criado_em).toLocaleString("pt-CV", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-gray-300">
                        {r.chave}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${OP_STYLES[r.operacao] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.operacao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 dark:text-gray-400">
                      {r.valor_antes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 dark:text-gray-100">
                      {r.valor_depois ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-400">
                      {ROLE_LABELS[r.usuario_role] ?? r.usuario_role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-gray-700/60 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="p-1.5 rounded-md border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-md border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
