"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatCVE, parseMesAno } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_PRICE_CVE_PER_KWH } from "@/modules/balanco/lib/balanco";
import { castRows } from "@/lib/supabase/types";

interface TendenciaProps {
  mesAno: string;
  zona?: string;
}

interface MesDatum {
  mes: string;       // "Jan", "Fev", ...
  mes_ano: string;   // "2025-04"
  perda_pct: number;
  kwh_injetado: number;
  kwh_faturado: number;
  perda_kwh: number;
  tarifa_media: number;
}

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getLast12Months(mesAno: string): string[] {
  const [y, m] = parseMesAno(mesAno);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(y, m - 1 - (11 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: MesDatum }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  const perdaCVE = d.perda_kwh * d.tarifa_media;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm text-sm space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-blue-600">Injetado: {d.kwh_injetado.toLocaleString("pt-CV")} kWh</p>
      <p className="text-green-600">Faturado: {d.kwh_faturado.toLocaleString("pt-CV")} kWh</p>
      <p className="text-red-600 font-medium">
        Perda: {d.perda_pct.toFixed(1)}% · {formatCVE(Math.max(0, perdaCVE))}
      </p>
    </div>
  );
};

export function TendenciaPerdas({ mesAno, zona }: TendenciaProps) {
  const [data, setData] = useState<MesDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
      const meses = getLast12Months(mesAno);

      const injecoesSelect = zona
        ? "mes_ano, total_kwh_injetado, subestacoes!inner(zona_bairro)"
        : "mes_ano, total_kwh_injetado";

      const fatSelect = zona
        ? "mes_ano, kwh_faturado, valor_cve, clientes!inner(subestacoes!inner(zona_bairro))"
        : "mes_ano, kwh_faturado, valor_cve";

      let injecoesQuery = supabase
        .from("injecao_energia")
        .select(injecoesSelect)
        .in("mes_ano", meses);

      let fatQuery = supabase
        .from("faturacao_clientes")
        .select(fatSelect)
        .in("mes_ano", meses);

      if (zona) {
        injecoesQuery = (injecoesQuery as typeof injecoesQuery).eq("subestacoes.zona_bairro", zona);
        fatQuery = (fatQuery as typeof fatQuery).eq("clientes.subestacoes.zona_bairro", zona);
      }

      const [{ data: injecoes }, { data: faturacao }] = await Promise.all([injecoesQuery, fatQuery]);

      // Aggregate by month
      const injetadoPorMes: Record<string, number> = {};
      for (const i of castRows<{ mes_ano: string; total_kwh_injetado: number }>(injecoes)) {
        injetadoPorMes[i.mes_ano] = (injetadoPorMes[i.mes_ano] ?? 0) + i.total_kwh_injetado;
      }

      const faturadoPorMes: Record<string, { kwh: number; cve: number }> = {};
      for (const f of castRows<{ mes_ano: string; kwh_faturado: number; valor_cve: number }>(faturacao)) {
        const prev = faturadoPorMes[f.mes_ano] ?? { kwh: 0, cve: 0 };
        faturadoPorMes[f.mes_ano] = { kwh: prev.kwh + f.kwh_faturado, cve: prev.cve + f.valor_cve };
      }

      const chartData: MesDatum[] = meses.map((m) => {
        const [, month] = parseMesAno(m);
        const kwh_injetado = injetadoPorMes[m] ?? 0;
        const { kwh: kwh_faturado, cve: cve_faturado } = faturadoPorMes[m] ?? { kwh: 0, cve: 0 };
        const perda_kwh = Math.max(0, kwh_injetado - kwh_faturado);
        const perda_pct = kwh_injetado > 0 ? (perda_kwh / kwh_injetado) * 100 : 0;
        const tarifa_media = kwh_faturado > 0 ? cve_faturado / kwh_faturado : DEFAULT_PRICE_CVE_PER_KWH;

        return {
          mes: MESES_PT[month - 1]!,
          mes_ano: m,
          perda_pct: parseFloat(perda_pct.toFixed(1)),
          kwh_injetado: Math.round(kwh_injetado),
          kwh_faturado: Math.round(kwh_faturado),
          perda_kwh: Math.round(perda_kwh),
          tarifa_media,
        };
      });

      setData(chartData);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [mesAno, zona, supabase]);

  const maxPerda = Math.max(...data.map((d) => d.perda_pct), 20);

  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] p-8 shadow-sm border border-outline-variant/10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-0.5">Histórico</p>
          <p className="font-bold text-on-surface text-lg">Tendência de Perdas — 12 Meses</p>
        </div>
        <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-red-400 inline-block rounded" />
          Limiar 15%
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-52 w-full rounded-lg" />
      ) : data.every((d) => d.kwh_injetado === 0) ? (
        <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de injeção nos últimos 12 meses
        </div>
      ) : (
        <div className="h-40 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="perdaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, Math.ceil(maxPerda / 5) * 5]}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={15}
              stroke="#EF4444"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="perda_pct"
              name="Perda %"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#perdaGradient)"
              dot={(props) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: MesDatum };
                if (payload.kwh_injetado === 0) return <g key={`dot-${payload.mes_ano}`} />;
                const isRed = payload.perda_pct >= 15;
                return (
                  <circle
                    key={`dot-${payload.mes_ano}`}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill={isRed ? "#EF4444" : "#94a3b8"}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{ r: 5, fill: "#EF4444", stroke: "white", strokeWidth: 2 }}
            />
          </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
