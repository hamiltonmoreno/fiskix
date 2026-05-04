"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, CheckCircle2, AlertCircle, XCircle, Camera, MapPin, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { exportToExcel } from "@/lib/export";

interface Profile {
  role: string;
  nome_completo: string;
  id_zona: string | null;
}

interface InspecaoRow {
  id: string;
  criado_em: string;
  resultado: string;
  foto_url: string | null;
  foto_lat: number | null;
  foto_lng: number | null;
  observacoes: string | null;
  id_fiscal: string;
  alertas_fraude: {
    score_risco: number;
    mes_ano: string;
    clientes: {
      nome_titular: string;
      numero_contador: string;
      subestacoes: { zona_bairro: string };
    };
  };
  perfis: { nome_completo: string } | null;
}

const PAGE_SIZE = 25;
const RESULTADOS = ["Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"] as const;

export function InspecoesClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<InspecaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroResultado, setFiltroResultado] = useState<string>("todos");
  const [filtroFiscal, setFiltroFiscal] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("relatorios_inspecao")
          .select(
            "id, criado_em, resultado, foto_url, foto_lat, foto_lng, observacoes, id_fiscal, alertas_fraude!inner(score_risco, mes_ano, clientes!inner(nome_titular, numero_contador, subestacoes!inner(zona_bairro))), perfis!relatorios_inspecao_id_fiscal_fkey(nome_completo)",
            { count: "exact" }
          )
          .order("criado_em", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (filtroResultado !== "todos") {
          query = query.eq("resultado", filtroResultado as typeof RESULTADOS[number]);
        }
        if (filtroFiscal !== "todos") {
          query = query.eq("id_fiscal", filtroFiscal);
        }

        const { data, count } = await query;
        setRows((data ?? []) as unknown as InspecaoRow[]);
        setTotal(count ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [filtroResultado, filtroFiscal, page, supabase]);

  useEffect(() => { setPage(0); }, [filtroResultado, filtroFiscal]);

  // KPIs derivados
  const kpis = useMemo(() => {
    const confirmadas = rows.filter((r) => r.resultado === "Fraude_Confirmada").length;
    const anomalias = rows.filter((r) => r.resultado === "Anomalia_Tecnica").length;
    const falsosPositivos = rows.filter((r) => r.resultado === "Falso_Positivo").length;
    const fiscalSet = new Set(rows.map((r) => r.id_fiscal));
    return { confirmadas, anomalias, falsosPositivos, fiscaisAtivos: fiscalSet.size };
  }, [rows]);

  function handleExport() {
    const headers = ["Data", "Fiscal", "Cliente", "Contador", "Zona", "Score", "Mês", "Resultado", "GPS"];
    const data = rows.map((r) => ({
      "Data": new Date(r.criado_em).toLocaleString("pt-CV"),
      "Fiscal": r.perfis?.nome_completo ?? "—",
      "Cliente": r.alertas_fraude.clientes.nome_titular,
      "Contador": r.alertas_fraude.clientes.numero_contador,
      "Zona": r.alertas_fraude.clientes.subestacoes.zona_bairro,
      "Score": r.alertas_fraude.score_risco,
      "Mês": r.alertas_fraude.mes_ano,
      "Resultado": r.resultado,
      "GPS": r.foto_lat && r.foto_lng ? `${r.foto_lat.toFixed(6)}, ${r.foto_lng.toFixed(6)}` : "—",
    }));
    exportToExcel("inspecoes", headers, data);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Inspeções
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Histórico operacional · auditoria de visitas e performance dos fiscais
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard icon={CheckCircle2} label="Fraudes confirmadas" value={kpis.confirmadas} tone="red" />
        <KpiCard icon={AlertCircle} label="Anomalias técnicas" value={kpis.anomalias} tone="amber" />
        <KpiCard icon={XCircle} label="Falsos positivos" value={kpis.falsosPositivos} tone="slate" />
        <KpiCard icon={Users} label="Fiscais ativos (página)" value={kpis.fiscaisAtivos} tone="blue" />
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <select
            value={filtroResultado}
            onChange={(e) => setFiltroResultado(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os resultados</option>
            {RESULTADOS.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover overflow-hidden">
        {loading ? (
          <div className="h-40 bg-slate-50 dark:bg-gray-900/40 animate-pulse" />
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-gray-400">Sem inspeções para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Zona</th>
                  <th className="px-4 py-3 text-left font-medium">Fiscal</th>
                  <th className="px-4 py-3 text-left font-medium">Resultado</th>
                  <th className="px-4 py-3 text-center font-medium">Provas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(r.criado_em).toLocaleDateString("pt-CV", { dateStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-gray-100">{r.alertas_fraude.clientes.nome_titular}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">{r.alertas_fraude.clientes.numero_contador}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 whitespace-nowrap">
                      {r.alertas_fraude.clientes.subestacoes.zona_bairro.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300 whitespace-nowrap">
                      {r.perfis?.nome_completo ?? "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.resultado} /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {r.foto_url && (
                          <a href={r.foto_url} target="_blank" rel="noopener noreferrer" title="Ver foto" className="p-1.5 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                            <Camera className="w-4 h-4" />
                          </a>
                        )}
                        {r.foto_lat && r.foto_lng && (
                          <a
                            href={`https://maps.google.com/?q=${r.foto_lat},${r.foto_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver no mapa"
                            className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                          >
                            <MapPin className="w-4 h-4" />
                          </a>
                        )}
                      </div>
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
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "red" | "amber" | "slate" | "blue";
}) {
  const palette = {
    red: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400",
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
    </div>
  );
}
