"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, FileText, AlertTriangle } from "lucide-react";

interface ErroLinha {
  linha?: number;
  row?: number;
  campo?: string;
  field?: string;
  mensagem?: string;
  message?: string;
  valor?: string;
  value?: string;
}

interface Importacao {
  id: string;
  tipo: string;
  nome_ficheiro: string;
  total_registos: number;
  registos_sucesso: number;
  registos_erro: number;
  erros_json: ErroLinha[] | null;
  criado_em: string;
  perfis: { nome_completo: string } | null;
}

export function ImportacaoDetalheClient({ importacao: imp }: { importacao: Importacao }) {
  const taxaSucesso = imp.total_registos > 0
    ? Math.round((imp.registos_sucesso / imp.total_registos) * 100)
    : 0;

  const erros: ErroLinha[] = Array.isArray(imp.erros_json) ? imp.erros_json : [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <Link href="/admin/importar" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar a Importar Dados
      </Link>

      <div className="flex items-start gap-4 mb-8">
        <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">{imp.nome_ficheiro}</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            {imp.tipo === "faturacao" ? "Faturação" : "Injeção de energia"} · {new Date(imp.criado_em).toLocaleString("pt-CV", { dateStyle: "medium", timeStyle: "short" })}
            {imp.perfis && ` · ${imp.perfis.nome_completo}`}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Total de linhas</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{imp.total_registos.toLocaleString("pt-CV")}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Importadas com sucesso</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{imp.registos_sucesso.toLocaleString("pt-CV")}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Linhas com erro</p>
          <p className={`text-2xl font-bold ${imp.registos_erro > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-gray-100"}`}>
            {imp.registos_erro.toLocaleString("pt-CV")}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Taxa de sucesso</p>
          <p className={`text-2xl font-bold ${taxaSucesso === 100 ? "text-emerald-600 dark:text-emerald-400" : taxaSucesso >= 90 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
            {taxaSucesso}%
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">Resultado da importação</span>
          <span className="text-xs text-slate-500 dark:text-gray-400">{taxaSucesso}% · {imp.registos_sucesso} de {imp.total_registos}</span>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${taxaSucesso}%` }} />
          {imp.registos_erro > 0 && (
            <div className="h-full bg-red-400 transition-all" style={{ width: `${100 - taxaSucesso}%` }} />
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {imp.registos_sucesso} sucesso</span>
          {imp.registos_erro > 0 && <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> {imp.registos_erro} erro(s)</span>}
        </div>
      </div>

      {/* Lista de erros */}
      {erros.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-red-200 dark:border-red-500/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100 dark:border-red-500/20 flex items-center gap-2 bg-red-50/50 dark:bg-red-500/5">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">{erros.length} erro(s) encontrado(s)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-right font-medium w-20">Linha</th>
                  <th className="px-4 py-3 text-left font-medium">Campo</th>
                  <th className="px-4 py-3 text-left font-medium">Mensagem</th>
                  <th className="px-4 py-3 text-left font-medium">Valor recebido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50 dark:divide-red-500/10">
                {erros.map((e, i) => (
                  <tr key={i} className="hover:bg-red-50/40 dark:hover:bg-red-500/5 transition-colors">
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500 dark:text-gray-400">
                      {e.linha ?? e.row ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-xs font-mono bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-gray-300">
                        {e.campo ?? e.field ?? "—"}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 text-xs">{e.mensagem ?? e.message ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <code className="text-xs font-mono text-red-600 dark:text-red-400">
                        {e.valor ?? e.value ?? "—"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Importação sem erros</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Todos os registos foram processados com sucesso.</p>
        </div>
      )}
    </div>
  );
}
