"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ExternalLink, AlertTriangle } from "lucide-react";

interface TopRisco {
  id: string;
  score_risco: number;
  status: string;
  id_cliente: string;
  cliente_nome: string;
  cliente_contador: string;
  zona: string;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-red-500" : score >= 50 ? "bg-amber-400" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-8 text-right ${score >= 75 ? "text-red-600 dark:text-red-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}>
        {score}
      </span>
    </div>
  );
}

export function DashboardCardTopRiscos({ mesAno, zona }: { mesAno: string; zona?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<TopRisco[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("alertas_fraude")
          .select("id, score_risco, status, id_cliente, clientes!inner(nome_titular, numero_contador, subestacoes!inner(zona_bairro))")
          .eq("mes_ano", mesAno)
          .not("status", "in", '("Fraude_Confirmada","Anomalia_Tecnica","Falso_Positivo")')
          .order("score_risco", { ascending: false })
          .limit(10);

        if (zona) q = q.eq("clientes.subestacoes.zona_bairro", zona);

        const { data } = await q;
        if (!cancelled) {
          setRows(
            (data ?? []).map((r) => {
              const c = r.clientes as { nome_titular: string; numero_contador: string; subestacoes: { zona_bairro: string } };
              return {
                id: r.id,
                score_risco: r.score_risco,
                status: r.status,
                id_cliente: r.id_cliente,
                cliente_nome: c.nome_titular,
                cliente_contador: c.numero_contador,
                zona: c.subestacoes.zona_bairro.replace(/_/g, " "),
              };
            })
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, mesAno, zona]);

  return (
    <div className="col-span-full xl:col-span-4 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Top 10 Clientes de Maior Risco</h2>
        </div>
        <Link href="/alertas" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Ver todos</Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">
          Sem alertas ativos para este período.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/40">
          {rows.map((r, i) => (
            <li key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{r.cliente_nome}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate">{r.cliente_contador} · {r.zona}</p>
              </div>
              <div className="w-28 shrink-0">
                <ScoreBar score={r.score_risco} />
              </div>
              <Link
                href={`/clientes/${r.id_cliente}`}
                className="shrink-0 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Ver ficha do cliente"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
