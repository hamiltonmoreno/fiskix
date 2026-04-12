"use client";

import { Card, CardContent } from "@/components/ui/card";
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

function KPICard({
  title, value, icon: Icon, iconClass, sub, delta, loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconClass: string;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={`p-2 rounded-lg ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold text-foreground">{value}</div>
        )}
        {!loading && (delta || sub) && (
          <p className="text-xs text-muted-foreground mt-1">{delta ?? sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KPICards({ data, loading }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Perda Estimada"
        value={data ? formatCVE(data.perda_cve_total) : "—"}
        icon={TrendingDown}
        iconClass="bg-red-100 text-red-600"
        delta={data ? <DeltaBadge pct={data.variacao_perda_pct} /> : undefined}
        loading={loading}
      />
      <KPICard
        title="Risco Crítico"
        value={data ? `${data.clientes_risco_critico} clientes` : "—"}
        icon={AlertTriangle}
        iconClass="bg-amber-100 text-amber-600"
        sub="score ≥ 75 este mês"
        loading={loading}
      />
      <KPICard
        title="Ordens Pendentes"
        value={data ? `${data.ordens_pendentes} ordens` : "—"}
        icon={ClipboardList}
        iconClass="bg-indigo-100 text-indigo-600"
        sub="aguardam inspeção física"
        loading={loading}
      />
      <KPICard
        title="Receita Recuperada"
        value={data ? formatCVE(data.receita_recuperada_ytd) : "—"}
        icon={TrendingUp}
        iconClass="bg-emerald-100 text-emerald-600"
        sub="fraudes confirmadas YTD"
        loading={loading}
      />
    </div>
  );
}
