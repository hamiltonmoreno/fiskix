"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useKPIs } from "@/modules/dashboard/hooks/useKPIs";
import { getCurrentMesAno } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/Icon";
import { DashboardCard12 } from "@/components/mosaic/cards/DashboardCard12";
import { DashboardCard06 } from "@/components/mosaic/cards/DashboardCard06";
import { DropdownFilter } from "@/components/mosaic/DropdownFilter";

// Import charts dynamically to avoid SSR issues with Recharts
const DashboardCardHeatMap = dynamic(
  () => import("@/components/mosaic/cards/DashboardCardHeatMap").then((m) => m.DashboardCardHeatMap),
  { ssr: false, loading: () => <Skeleton className="h-[268px] rounded-xl" /> }
);
const DashboardCard01 = dynamic(
  () => import("@/components/mosaic/cards/DashboardCard01").then((m) => m.DashboardCard01),
  { ssr: false, loading: () => <Skeleton className="h-[268px] rounded-xl" /> }
);
const DashboardCard04 = dynamic(
  () => import("@/components/mosaic/cards/DashboardCard04").then((m) => m.DashboardCard04),
  { ssr: false, loading: () => <Skeleton className="h-[268px] rounded-xl" /> }
);
const DashboardCard07 = dynamic(
  () => import("@/components/mosaic/cards/DashboardCard07").then((m) => m.DashboardCard07),
  { ssr: false, loading: () => <Skeleton className="h-[268px] rounded-xl" /> }
);

interface DashboardClientProps {
  profile: {
    role: string;
    nome_completo: string;
    id_zona: string | null;
  };
}

const ZONAS = [
  "Todos",
  "Palmarejo",
  "Achada_Santo_Antonio",
  "Achada_Grande",
  "Plateau",
];

const MESES = Array.from({ length: 12 }, (_, i) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), i - 12 + now.getMonth(), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}).reverse();

export function DashboardClient({ profile }: DashboardClientProps) {
  const [mesAno, setMesAno] = useState(getCurrentMesAno());
  const [zonasSelecionadas, setZonasSelecionadas] = useState<string[]>([]);
  const zona = zonasSelecionadas[0]; // single-select: first (and only) item, or undefined
  const router = useRouter();

  // Constrain to single selection: only keep the newly added zone
  const handleZonaChange = useCallback((newSelected: string[]) => {
    const added = newSelected.find((z) => !zonasSelecionadas.includes(z));
    setZonasSelecionadas(added ? [added] : []);
  }, [zonasSelecionadas]);

  const { data: kpis, loading: kpisLoading } = useKPIs(mesAno, zona);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const filterOptions = ZONAS.filter(z => z !== "Todos").map(z => ({
    label: z.replace(/_/g, " "),
    value: z
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      {/* ── Page Header ── */}
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        
        {/* Left: Title */}
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            {greeting}, {profile.nome_completo.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visão geral de perdas e alertas do sistema Electra.
          </p>
        </div>

        {/* Right: Actions */}
        <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
          
          {/* Mês dropdown (simplified to use native select for Mosaic look) */}
          <div className="relative">
            <select
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer w-full"
            >
              {MESES.map((m) => (
                <option key={m} value={m}>
                  {new Date(m + "-01").toLocaleDateString("pt-CV", {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon name="calendar_today" size="xs" className="text-gray-400" />
            </div>
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <Icon name="arrow_drop_down" size="xs" className="text-gray-400" />
            </div>
          </div>

          <DropdownFilter
            label="Zona"
            options={filterOptions}
            selected={zonasSelecionadas}
            onChange={handleZonaChange}
          />

          <button
            onClick={() => router.push("/relatorios")}
            className="bg-primary hover:bg-primary/90 text-white font-medium text-sm px-3 py-2 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2 touch-manipulation"
          >
            <Icon name="summarize" size="xs" className="text-white" />
            <span>Relatórios</span>
          </button>
        </div>
      </div>

      {/* ── Dashboard Cards ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Row 1: KPIs Mini stats */}
        <div className="col-span-full">
          <DashboardCard12 data={kpis} loading={kpisLoading} />
        </div>

        {/* Row 2: Tendência (Line) and Top 5 (Bar) */}
        <DashboardCard01 mesAno={mesAno} zona={zona} />
        <DashboardCard04 mesAno={mesAno} />
        
        {/* Row 3: Heatmap and Alerts Breakdown (Doughnut) */}
        <DashboardCardHeatMap mesAno={mesAno} zona={zona} />
        <DashboardCard06 mesAno={mesAno} zona={zona} />

        {/* Row 4: Tabela de Alertas */}
        <DashboardCard07 mesAno={mesAno} zona={zona} />
      </div>
    </div>
  );
}
