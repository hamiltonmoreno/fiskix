"use client";

import { useEffect, useState } from "react";
import { MosaicDoughnutChart } from "../charts/MosaicDoughnutChart";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { appColors } from "../charts/RechartsConfig";

interface DashboardCard06Props {
  mesAno: string;
  zona?: string;
}

export function DashboardCard06({ mesAno, zona }: DashboardCard06Props) {
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let query = supabase
          .from("alertas_fraude")
          .select("status, clientes!inner(subestacoes!inner(zona_bairro))")
          .eq("mes_ano", mesAno);

        if (zona) {
          query = (query as typeof query).eq("clientes.subestacoes.zona_bairro", zona);
        }

        const { data: alertas } = await query;

        const contagem: Record<string, number> = {
          "Pendente Inspecao": 0,
          "Fraude Confirmada": 0,
          "Inspecao Sem Fraude": 0,
        };

        (alertas || []).forEach((a) => {
          const status = String(a.status);
          if (status === "Pendente_Inspecao") contagem["Pendente Inspecao"]!++;
          else if (status === "Fraude_Confirmada" || status === "Alerta_Fraude") contagem["Fraude Confirmada"]!++;
          else if (status === "Inspecao_Sem_Fraude") contagem["Inspecao Sem Fraude"]!++;
        });

        const chartData = [
          { name: "Fraude Confirmada", value: contagem["Fraude Confirmada"]!, color: appColors.danger },
          { name: "Pendente", value: contagem["Pendente Inspecao"]!, color: appColors.warning },
          { name: "Sem Fraude", value: contagem["Inspecao Sem Fraude"]!, color: appColors.success },
        ].filter((d) => d.value > 0);

        setData(chartData);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [mesAno, zona, supabase]);

  const total = data.reduce((acc, d) => acc + d.value, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; color: string } }> }) => {
    if (!active || !payload?.length) return null;
    const { name, value, color } = payload[0]!.payload;
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-lg p-2 text-sm z-50 min-w-32">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-semibold text-gray-800 dark:text-gray-100">{name}</span>
        </div>
        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
          <span>{value} incidentes</span>
          <span className="font-medium text-gray-800 dark:text-gray-100">{pct}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
      <div className="px-5 pt-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Desfecho de Alertas</h2>
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
          Distribuição por status
        </div>
      </div>
      
      <div className="grow flex items-center justify-center p-4">
        {loading ? (
          <Skeleton className="h-[232px] w-full rounded-full" />
        ) : data.length === 0 ? (
          <div className="h-[232px] flex items-center justify-center text-gray-500 text-sm">
            Sem alertas para {mesAno}
          </div>
        ) : (
          <div className="relative w-full h-[232px]">
            <MosaicDoughnutChart
              data={data}
              height={232}
              tooltipContent={<CustomTooltip />}
            />
            {/* Center text overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-3xl font-bold text-gray-800 dark:text-gray-100">{total}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
