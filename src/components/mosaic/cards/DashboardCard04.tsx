"use client";

import { useEffect, useState } from "react";
import { MosaicBarChart } from "../charts/MosaicBarChart";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCVE } from "@/lib/utils";
import { appColors } from "../charts/RechartsConfig";

interface DashboardCard04Props {
  mesAno: string;
}

interface SubChartData {
  nome: string;
  fullName: string;
  injetado: number;
  faturado: number;
  tarifa_media: number;
}

interface TooltipEntry {
  name: string;
  value: number;
  payload: SubChartData;
}

export function DashboardCard04({ mesAno }: DashboardCard04Props) {
  const [data, setData] = useState<SubChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: injecoes } = await supabase
          .from("injecao_energia")
          .select("id_subestacao, total_kwh_injetado, subestacoes(nome)")
          .eq("mes_ano", mesAno)
          .order("total_kwh_injetado", { ascending: false })
          .limit(5);

        if (!injecoes?.length) {
          setData([]);
          return;
        }

        const subIds = injecoes.map((i) => i.id_subestacao);

        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, id_subestacao")
          .in("id_subestacao", subIds);

        const clienteIds = (clientes || []).map((c) => c.id);

        const { data: faturacao } = await supabase
          .from("faturacao_clientes")
          .select("id_cliente, kwh_faturado, valor_cve")
          .eq("mes_ano", mesAno)
          .in("id_cliente", clienteIds);

        const faturacaoPorCliente: Record<string, { kwh: number; cve: number }> = {};
        for (const f of faturacao || []) {
          faturacaoPorCliente[f.id_cliente] = { kwh: f.kwh_faturado, cve: f.valor_cve };
        }

        const faturacaoPorSub: Record<string, { kwh: number; cve: number }> = {};
        for (const c of clientes || []) {
          const prev = faturacaoPorSub[c.id_subestacao] || { kwh: 0, cve: 0 };
          const fat = faturacaoPorCliente[c.id] || { kwh: 0, cve: 0 };
          faturacaoPorSub[c.id_subestacao] = {
            kwh: prev.kwh + fat.kwh,
            cve: prev.cve + fat.cve,
          };
        }

        const chartData = injecoes.map((inj) => {
          const sub = inj.subestacoes as { nome: string } | null;
          const kwh_injetado = inj.total_kwh_injetado;
          const { kwh: kwh_faturado, cve: cve_faturado } = faturacaoPorSub[inj.id_subestacao] || { kwh: 0, cve: 0 };
          
          return {
            nome: sub?.nome ? (sub.nome.split(' ').pop() ?? "Desc.") : "Desc.",
            fullName: sub?.nome || "Desconhecida",
            injetado: Math.round(kwh_injetado),
            faturado: Math.round(kwh_faturado),
            tarifa_media: kwh_faturado > 0 ? cve_faturado / kwh_faturado : 15,
          };
        });

        setData(chartData);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [mesAno, supabase]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) => {
    if (!active || !payload?.length) return null;

    const inj = payload.find((p) => p.name === "Injetado")?.value || 0;
    const fat = payload.find((p) => p.name === "Faturado")?.value || 0;
    const tarifaMedia = payload[0]?.payload?.tarifa_media || 15;
    const perdaKwh = inj - fat;
    const perdaCVE = perdaKwh * tarifaMedia;
    const fullName = payload[0]?.payload?.fullName || label;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-lg p-3 text-sm min-w-48">
        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{fullName}</p>
        
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: appColors.primaryLight }} />
            <span className="text-gray-500">Injetado</span>
          </div>
          <span className="font-medium text-gray-800 dark:text-gray-100">{(inj/1000).toFixed(1)}k</span>
        </div>
        
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: appColors.primary }} />
            <span className="text-gray-500">Faturado</span>
          </div>
          <span className="font-medium text-gray-800 dark:text-gray-100">{(fat/1000).toFixed(1)}k</span>
        </div>

        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
          <div className="flex justify-between items-center">
            <span className="text-red-500 font-medium">Perda Estimada</span>
            <span className="font-bold text-red-500">{formatCVE(Math.max(0, perdaCVE))}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
      <div className="px-5 pt-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Top 5 Transformadores</h2>
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
          Análise de KWh
        </div>
      </div>
      
      <div className="grow">
        {loading ? (
          <div className="px-5 pb-5">
            <Skeleton className="h-[268px] w-full" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-[268px] flex items-center justify-center text-gray-500 text-sm">
            Sem dados para {mesAno}
          </div>
        ) : (
          <MosaicBarChart
            data={data}
            bars={[
              { dataKey: "injetado", name: "Injetado", fill: appColors.primaryLight, stackId: "" },
              { dataKey: "faturado", name: "Faturado", fill: appColors.primary, stackId: "" }
            ]}
            xAxisKey="nome"
            height={268}
            yAxisFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tooltipContent={<CustomTooltip />}
            showLegend={true}
          />
        )}
      </div>
    </div>
  );
}
