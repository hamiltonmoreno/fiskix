"use client";

import { createElement, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { MosaicLineChart } from "../charts/MosaicLineChart";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCVE, cn } from "@/lib/utils";

interface DashboardCard01Props {
  mesAno: string;
  zona?: string;
}

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getLast12Months(mesAno: string): string[] {
  const [y, m] = mesAno.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(y, m - 1 - (11 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function DashboardCard01({ mesAno, zona }: DashboardCard01Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPerda, setCurrentPerda] = useState({ pct: 0, delta: 0, cve: 0 });
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

        let injecoesQuery = supabase.from("injecao_energia").select(injecoesSelect).in("mes_ano", meses);
        let fatQuery = supabase.from("faturacao_clientes").select(fatSelect).in("mes_ano", meses);

        if (zona) {
          injecoesQuery = (injecoesQuery as any).eq("subestacoes.zona_bairro", zona);
          fatQuery = (fatQuery as any).eq("clientes.subestacoes.zona_bairro", zona);
        }

        const [{ data: injecoes }, { data: faturacao }] = await Promise.all([injecoesQuery, fatQuery]);

        const injetadoPorMes: Record<string, number> = {};
        for (const i of ((injecoes || []) as any[])) {
          injetadoPorMes[i.mes_ano] = (injetadoPorMes[i.mes_ano] || 0) + i.total_kwh_injetado;
        }

        const faturadoPorMes: Record<string, { kwh: number; cve: number }> = {};
        for (const f of ((faturacao || []) as any[])) {
          const prev = faturadoPorMes[f.mes_ano] || { kwh: 0, cve: 0 };
          faturadoPorMes[f.mes_ano] = { kwh: prev.kwh + f.kwh_faturado, cve: prev.cve + f.valor_cve };
        }

        const chartData = meses.map((m) => {
          const [, month] = m.split("-").map(Number);
          const kwh_injetado = injetadoPorMes[m] || 0;
          const { kwh: kwh_faturado, cve: cve_faturado } = faturadoPorMes[m] || { kwh: 0, cve: 0 };
          const perda_kwh = Math.max(0, kwh_injetado - kwh_faturado);
          const perda_pct = kwh_injetado > 0 ? (perda_kwh / kwh_injetado) * 100 : 0;

          return {
            mes: MESES_PT[month - 1],
            mes_ano: m,
            perda_pct: parseFloat(perda_pct.toFixed(1)),
            kwh_injetado,
            perda_kwh,
            tarifa_media: kwh_faturado > 0 ? cve_faturado / kwh_faturado : 15,
          };
        });

        setData(chartData);
        
        // Calculate current month vs previous month stats
        const currentM = chartData[chartData.length - 1];
        const prevM = chartData[chartData.length - 2];
        if (currentM && prevM) {
          const delta = currentM.perda_pct - prevM.perda_pct;
          setCurrentPerda({
            pct: currentM.perda_pct,
            delta: parseFloat(delta.toFixed(1)),
            cve: currentM.perda_kwh * currentM.tarifa_media
          });
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [mesAno, zona, supabase]);

  const isDeltaNegative = currentPerda.delta < 0; // Negative loss delta is good

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const perdaCVE = d.perda_kwh * d.tarifa_media;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{label}</p>
        <p className="text-gray-500 mb-2">Perda do mês</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-gray-800 dark:text-gray-100 font-medium">{d.perda_pct.toFixed(1)}%</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Custo ~{formatCVE(Math.max(0, perdaCVE))}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
      <div className="px-5 pt-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Tendência de Perdas (%)</h2>
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
          Histórico 12 Meses
        </div>
        
        {loading ? (
          <Skeleton className="h-8 w-24 mb-2" />
        ) : (
          <div className="flex items-start">
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 mr-2">
              {currentPerda.pct}%
            </div>
            {currentPerda.delta !== 0 && (
              <div className={cn(
                "text-sm font-semibold px-1.5 rounded-full",
                isDeltaNegative ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" 
                                : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
              )}>
                {isDeltaNegative ? "-" : "+"}{Math.abs(currentPerda.delta)}%
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grow mt-4">
        {loading ? (
          <Skeleton className="h-[248px] w-full" />
        ) : data.every((d) => d.kwh_injetado === 0) ? (
          <div className="h-[248px] flex items-center justify-center text-gray-500 text-sm">
            Sem dados de injeção
          </div>
        ) : (
          <MosaicLineChart
            data={data}
            lines={[
              { dataKey: "perda_pct", name: "Perda (%)", isPrimary: true }
            ]}
            xAxisKey="mes"
            height={248}
            tooltipContent={<CustomTooltip />}
            showGrid={false}
          />
        )}
      </div>
    </div>
  );
}
