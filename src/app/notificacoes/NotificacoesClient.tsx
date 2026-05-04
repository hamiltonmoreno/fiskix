"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Phone, Hash, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ScoreBadge } from "@/components/ui/score-badge";
import { exportToExcel } from "@/lib/export";

interface Profile {
  role: string;
  nome_completo: string;
  id_zona: string | null;
}

interface NotificacaoRow {
  id: string;
  status: string;
  resultado: string | null;
  score_risco: number;
  mes_ano: string;
  updated_at: string;
  clientes: {
    nome_titular: string;
    numero_contador: string;
    telemovel: string | null;
    subestacoes: { zona_bairro: string };
  };
}

const PAGE_SIZE = 25;

export function NotificacoesClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<NotificacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // SMS são marcados implicitamente quando status passa de "Pendente" para
        // "Notificado_SMS". Para histórico, listamos qualquer alerta que já foi
        // notificado (status atual ≥ Notificado_SMS).
        const { data, count } = await supabase
          .from("alertas_fraude")
          .select(
            "id, status, resultado, score_risco, mes_ano, updated_at, clientes!inner(nome_titular, numero_contador, telemovel, subestacoes!inner(zona_bairro))",
            { count: "exact" }
          )
          .in("status", ["Notificado_SMS", "Pendente_Inspecao", "Inspecionado"])
          .order("updated_at", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        setRows((data ?? []) as unknown as NotificacaoRow[]);
        setTotal(count ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, supabase]);

  function tipoSMS(score: number) {
    return score >= 75 ? "vermelho" : "amarelo";
  }

  function handleExport() {
    const headers = ["Data", "Cliente", "Contador", "Telemóvel", "Zona", "Tipo SMS", "Score", "Mês", "Estado atual"];
    const data = rows.map((r) => ({
      "Data": new Date(r.updated_at).toLocaleString("pt-CV"),
      "Cliente": r.clientes.nome_titular,
      "Contador": r.clientes.numero_contador,
      "Telemóvel": r.clientes.telemovel ?? "—",
      "Zona": r.clientes.subestacoes.zona_bairro,
      "Tipo SMS": tipoSMS(r.score_risco),
      "Score": r.score_risco,
      "Mês": r.mes_ano,
      "Estado atual": r.status,
    }));
    exportToExcel("notificacoes_sms", headers, data);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const enviadosVermelho = rows.filter((r) => r.score_risco >= 75).length;
  const enviadosAmarelo = rows.length - enviadosVermelho;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Notificações SMS
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Auditoria de SMS enviados aos clientes (valor jurídico de prova)
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Exportar Excel
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard icon={MessageSquare} label="Total notificados" value={total} subtitle="histórico completo" tone="blue" />
        <KpiCard icon={AlertTriangle} label="SMS vermelho" value={enviadosVermelho} subtitle="score ≥ 75" tone="red" />
        <KpiCard icon={CheckCircle2} label="SMS amarelo" value={enviadosAmarelo} subtitle="score < 75" tone="amber" />
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover overflow-hidden">
        {loading ? (
          <div className="h-40 bg-slate-50 dark:bg-gray-900/40 animate-pulse" />
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-gray-400">Nenhum SMS enviado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Telemóvel</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo SMS</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Mês ref.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                {rows.map((r) => {
                  const tipo = tipoSMS(r.score_risco);
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 whitespace-nowrap text-xs">
                        {new Date(r.updated_at).toLocaleDateString("pt-CV", { dateStyle: "short" })}
                        <span className="text-slate-400 ml-2">{new Date(r.updated_at).toLocaleTimeString("pt-CV", { timeStyle: "short" })}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-gray-100">{r.clientes.nome_titular}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 font-mono inline-flex items-center gap-1"><Hash className="w-3 h-3" />{r.clientes.numero_contador}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
                        {r.clientes.telemovel ? (
                          <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{r.clientes.telemovel}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipo === "vermelho" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"}`}>
                          {tipo === "vermelho" ? "Vermelho (crítico)" : "Amarelo (médio)"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ScoreBadge score={r.score_risco} showScore /></td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 font-mono text-xs">{r.mes_ano}</td>
                    </tr>
                  );
                })}
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
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Seguinte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtitle: string;
  tone: "red" | "amber" | "blue";
}) {
  const palette = {
    red: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  };
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${palette[tone]} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-gray-100">{value}</div>
      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}
