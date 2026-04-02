"use client";

import { formatCVE } from "@/lib/utils";
import type { KPIData } from "../types";
import { TrendingDown, AlertTriangle, ClipboardList, TrendingUp } from "lucide-react";

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  sub,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 bg-slate-100 animate-pulse rounded w-3/4" />
      ) : (
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      )}
      {sub && (
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
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
        color="bg-red-100 text-red-600"
        sub="mês atual vs energia injetada"
        loading={loading}
      />
      <KPICard
        title="Risco Crítico"
        value={data ? `${data.clientes_risco_critico} clientes` : "—"}
        icon={AlertTriangle}
        color="bg-amber-100 text-amber-600"
        sub="score ≥ 75 este mês"
        loading={loading}
      />
      <KPICard
        title="Ordens Pendentes"
        value={data ? `${data.ordens_pendentes}` : "—"}
        icon={ClipboardList}
        color="bg-blue-100 text-blue-600"
        sub="aguardam inspeção física"
        loading={loading}
      />
      <KPICard
        title="Receita Recuperada"
        value={data ? formatCVE(data.receita_recuperada_ytd) : "—"}
        icon={TrendingUp}
        color="bg-green-100 text-green-600"
        sub="fraudes confirmadas este ano"
        loading={loading}
      />
    </div>
  );
}
