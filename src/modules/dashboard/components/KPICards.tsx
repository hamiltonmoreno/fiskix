"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCVE } from "@/lib/utils";
import { TrendingDown, AlertTriangle, ClipboardList, TrendingUp } from "lucide-react";
import type { KPIData } from "../types";

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

function DeltaBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const isWorse = pct > 0;
  return (
    <span className={`text-xs font-medium ${isWorse ? "text-red-600" : "text-emerald-600"}`}>
      {isWorse ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}% vs mês ant.
    </span>
  );
}

type Severity = "danger" | "warning" | "neutral" | "success";

const SEVERITY_STYLES: Record<Severity, {
  border: string;
  iconBg: string;
  iconColor: string;
  valuePulse?: string;
}> = {
  danger: {
    border: "border-l-4 border-l-red-500",
    iconBg: "bg-red-50 dark:bg-red-950/30",
    iconColor: "text-red-500",
    valuePulse: "text-red-700 dark:text-red-400",
  },
  warning: {
    border: "border-l-4 border-l-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-500",
    valuePulse: "text-amber-700 dark:text-amber-400",
  },
  neutral: {
    border: "border-l-4 border-l-indigo-500",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/30",
    iconColor: "text-indigo-500",
  },
  success: {
    border: "border-l-4 border-l-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
    iconColor: "text-emerald-500",
    valuePulse: "text-emerald-700 dark:text-emerald-400",
  },
};

function KPICard({
  title,
  value,
  icon: Icon,
  severity,
  sub,
  delta,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  severity: Severity;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  loading: boolean;
}) {
  const styles = SEVERITY_STYLES[severity];
  return (
    <div
      className={cn(
        "kpi-card bg-card rounded-xl border border-border px-5 py-4 flex flex-col gap-3",
        styles.border
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className={cn("p-2 rounded-lg", styles.iconBg)}>
          <Icon className={cn("w-4 h-4", styles.iconColor)} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-9 w-3/4" />
      ) : (
        <div
          className={cn(
            "font-heading text-3xl leading-none tracking-tight",
            styles.valuePulse ?? "text-foreground"
          )}
        >
          {value}
        </div>
      )}

      {!loading && (delta || sub) && (
        <p className="text-xs text-muted-foreground">{delta ?? sub}</p>
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
        icon={TrendingDown}
        severity="danger"
        delta={data ? <DeltaBadge pct={data.variacao_perda_pct} /> : undefined}
        loading={loading}
      />
      <KPICard
        title="Risco Crítico"
        value={data ? `${data.clientes_risco_critico}` : "—"}
        icon={AlertTriangle}
        severity="warning"
        sub="clientes · score ≥ 75"
        loading={loading}
      />
      <KPICard
        title="Ordens Pendentes"
        value={data ? `${data.ordens_pendentes}` : "—"}
        icon={ClipboardList}
        severity="neutral"
        sub="aguardam inspeção física"
        loading={loading}
      />
      <KPICard
        title="Receita Recuperada"
        value={data ? formatCVE(data.receita_recuperada_ytd) : "—"}
        icon={TrendingUp}
        severity="success"
        sub="fraudes confirmadas YTD"
        loading={loading}
      />
    </div>
  );
}
