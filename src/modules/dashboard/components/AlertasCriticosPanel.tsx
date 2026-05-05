"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Icon } from "@/components/Icon";
import type { KPIData } from "../types";

interface AlertasCriticosPanelProps {
  alertas: KPIData["alertas_criticos"] | undefined;
  loading: boolean;
  mesAno: string;
}

export function AlertasCriticosPanel({ alertas, loading, mesAno }: AlertasCriticosPanelProps) {
  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-0.5">
            Score ≥ 75
          </p>
          <p className="font-bold text-on-surface">Alertas Críticos</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-[#ffdad6] flex items-center justify-center flex-shrink-0">
          <Icon name="warning" size="sm" className="text-[#ba1a1a]" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 space-y-1 overflow-y-auto max-h-[24rem] lg:max-h-none">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))
        ) : !alertas || alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon name="check_circle" size="lg" className="text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-on-surface">Sem alertas críticos</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Tudo normal este mês</p>
          </div>
        ) : (
          alertas.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-low transition-colors"
            >
              <ScoreBadge score={a.score_risco} showScore className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate">
                  {a.cliente.nome_titular}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {a.subestacao.zona_bairro.replace(/_/g, " ")}
                </p>
              </div>
              <StatusBadge status={a.status} className="shrink-0" />
            </div>
          ))
        )}
      </div>

      {/* Footer link */}
      <div className="pt-4 mt-2 border-t border-outline-variant/20">
        <Link
          href={`/alertas?mes=${mesAno}&min_score=75`}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Ver todos os alertas críticos
          <Icon name="chevron_right" size="xs" />
        </Link>
      </div>
    </div>
  );
}
