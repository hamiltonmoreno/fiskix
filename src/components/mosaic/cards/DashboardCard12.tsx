"use client";

import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCVE, cn } from "@/lib/utils";
import type { KPIData } from "@/modules/dashboard/types";

interface DashboardCard12Props {
  data: KPIData | null;
  loading: boolean;
}

function MiniStatCard({
  title,
  value,
  icon,
  iconBgColor,
  iconTextColor,
  delta,
  deltaType = "neutral",
  subtext,
  loading
}: {
  title: string;
  value: string;
  icon: string;
  iconBgColor: string;
  iconTextColor: string;
  delta?: string | number;
  deltaType?: "positive" | "negative" | "neutral";
  subtext?: string;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-3 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-5">
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{title}</h2>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center -mt-1 -mr-1", iconBgColor)}>
          <Icon name={icon} size="xs" className={iconTextColor} filled />
        </div>
      </div>
      
      {loading ? (
        <div className="mt-2 mb-1">
          <Skeleton className="h-8 w-3/4" />
        </div>
      ) : (
        <div className="flex items-baseline gap-2 mb-1">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">
            {value}
          </div>
          {delta !== undefined && (
            <div className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
              deltaType === "positive" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" :
              deltaType === "negative" ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" :
              "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            )}>
              {deltaType !== "neutral" && (
                <Icon name={deltaType === "positive" ? "trending_up" : "trending_down"} size="xs" className="w-3 h-3" />
              )}
              {delta}
            </div>
          )}
        </div>
      )}
      
      {!loading && subtext && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-auto pt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

export function DashboardCard12({ data, loading }: DashboardCard12Props) {
  // Logic to determine if Perda CVE var is positive or negative (for Losses, negative var is GOOD/positive outcome)
  const perdaPct = data?.variacao_perda_pct || 0;
  let deltaType: "positive" | "negative" | "neutral" = "neutral";
  let deltaText = "";
  
  if (perdaPct !== 0) {
    deltaType = perdaPct > 0 ? "negative" : "positive"; // >0 means losses went up (bad/negative outcome)
    deltaText = `${perdaPct > 0 ? "+" : ""}${perdaPct}%`;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <MiniStatCard
        title="Perda Estimada"
        value={data ? formatCVE(data.perda_cve_total) : "—"}
        icon="electric_meter"
        iconBgColor="bg-red-50 dark:bg-red-500/10"
        iconTextColor="text-red-500"
        delta={deltaText}
        deltaType={deltaType}
        subtext="Relativo ao mês anterior"
        loading={loading}
      />
      <MiniStatCard
        title="Risco Crítico"
        value={data ? `${data.clientes_risco_critico}` : "—"}
        icon="warning"
        iconBgColor="bg-amber-50 dark:bg-amber-500/10"
        iconTextColor="text-amber-500"
        subtext="Clientes com score ≥ 75"
        loading={loading}
      />
      <MiniStatCard
        title="Ordens Pendentes"
        value={data ? `${data.ordens_pendentes}` : "—"}
        icon="assignment"
        iconBgColor="bg-blue-50 dark:bg-blue-500/10"
        iconTextColor="text-blue-500"
        subtext="Aguardam inspeção física"
        loading={loading}
      />
      <MiniStatCard
        title="Receita Recuperada"
        value={data ? formatCVE(data.receita_recuperada_ytd) : "—"}
        icon="savings"
        iconBgColor="bg-emerald-50 dark:bg-emerald-500/10"
        iconTextColor="text-emerald-500"
        subtext="Fraudes confirmadas YTD"
        loading={loading}
      />
    </div>
  );
}
