"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCVE } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import type { KPIData } from "../types";

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

function DeltaBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const isWorse = pct > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold",
      isWorse
        ? "text-[#ba1a1a] bg-[#ffdad6]"
        : "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40"
    )}>
      <Icon name={isWorse ? "trending_up" : "trending_down"} size="xs" />
      {Math.abs(pct).toFixed(1)}% vs mês ant.
    </span>
  );
}

type Severity = "danger" | "warning" | "neutral" | "success";

const SEVERITY_STYLES: Record<Severity, {
  iconBg: string;
  iconColor: string;
  valueColor: string;
  dot: string;
}> = {
  danger: {
    iconBg: "bg-red-100 dark:bg-red-950/40",
    iconColor: "text-red-500",
    valueColor: "text-red-700 dark:text-red-400",
    dot: "bg-red-400",
  },
  warning: {
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-500",
    valueColor: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  neutral: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    valueColor: "text-foreground",
    dot: "bg-primary",
  },
  success: {
    iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
    iconColor: "text-emerald-600",
    valueColor: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
};

function KPICard({
  title,
  value,
  iconName,
  severity,
  sub,
  delta,
  loading,
}: {
  title: string;
  value: string;
  iconName: string;
  severity: Severity;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  loading: boolean;
}) {
  const styles = SEVERITY_STYLES[severity];
  return (
    <div className="kpi-card bg-surface-container-lowest rounded-[1.5rem] border border-outline-variant/10 shadow-sm px-6 py-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", styles.dot)} />
          <span className="text-sm font-medium text-on-surface-variant truncate">{title}</span>
        </div>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", styles.iconBg)}>
          <Icon name={iconName} size="sm" className={styles.iconColor} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-9 w-3/4 rounded-xl" />
      ) : (
        <div className={cn("text-[2rem] font-bold leading-none tracking-tighter tabular-nums text-on-surface", styles.valueColor)}>
          {value}
        </div>
      )}

      {!loading && (delta || sub) && (
        <div className="text-xs text-muted-foreground">{delta ?? sub}</div>
      )}
    </div>
  );
}

export function KPICards({ data, loading }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Perda Estimada"
        value={data ? formatCVE(data.perda_cve_total) : "—"}
        iconName="trending_down"
        severity="danger"
        delta={data ? <DeltaBadge pct={data.variacao_perda_pct} /> : undefined}
        loading={loading}
      />
      <KPICard
        title="Risco Crítico"
        value={data ? `${data.clientes_risco_critico}` : "—"}
        iconName="warning"
        severity="warning"
        sub="clientes · score ≥ 75"
        loading={loading}
      />
      <KPICard
        title="Ordens Pendentes"
        value={data ? `${data.ordens_pendentes}` : "—"}
        iconName="assignment"
        severity="neutral"
        sub="aguardam inspeção física"
        loading={loading}
      />
      <KPICard
        title="Receita Recuperada"
        value={data ? formatCVE(data.receita_recuperada_ytd) : "—"}
        iconName="savings"
        severity="success"
        sub="fraudes confirmadas YTD"
        loading={loading}
      />
    </div>
  );
}
