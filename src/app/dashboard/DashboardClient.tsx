"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { KPICards } from "@/modules/dashboard/components/KPICards";
import { TabelaAlertas } from "@/modules/dashboard/components/TabelaAlertas";
import { AlertasCriticosPanel } from "@/modules/dashboard/components/AlertasCriticosPanel";
import { useKPIs } from "@/modules/dashboard/hooks/useKPIs";
import { getCurrentMesAno } from "@/lib/utils";

const HeatMap = dynamic(
  () => import("@/modules/dashboard/components/HeatMap").then((m) => m.HeatMap),
  { ssr: false, loading: () => <div className="h-64 bg-slate-100 rounded-xl animate-pulse" /> }
);
const Top5Transformadores = dynamic(
  () => import("@/modules/dashboard/components/Top5Transformadores").then((m) => m.Top5Transformadores),
  { ssr: false, loading: () => <div className="h-64 bg-slate-100 rounded-xl animate-pulse" /> }
);
const TendenciaPerdas = dynamic(
  () => import("@/modules/dashboard/components/TendenciaPerdas").then((m) => m.TendenciaPerdas),
  { ssr: false, loading: () => <div className="h-48 bg-slate-100 rounded-xl animate-pulse" /> }
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
  const [zona, setZona] = useState<string | undefined>(undefined);
  const { data: kpis, loading: kpisLoading } = useKPIs(mesAno, zona);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar — filtros apenas */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold text-slate-900 hidden sm:block">
            Dashboard
          </h1>
          <div className="flex items-center gap-2 ml-auto">
            <label htmlFor="dashboard-mes" className="sr-only">
              Filtrar por mês
            </label>
            <select
              id="dashboard-mes"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

            <label htmlFor="dashboard-zona" className="sr-only">
              Filtrar por zona
            </label>
            <select
              id="dashboard-zona"
              value={zona ?? "Todos"}
              onChange={(e) =>
                setZona(e.target.value === "Todos" ? undefined : e.target.value)
              }
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {z === "Todos" ? "Todas as zonas" : z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <span className="text-sm text-slate-500 hidden lg:block whitespace-nowrap">
            {profile.nome_completo}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 lg:px-6 py-6 space-y-6" id="alertas">
        <KPICards data={kpis} loading={kpisLoading} />

        {/* 2-column: mapa + alertas críticos */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-80">
            <HeatMap mesAno={mesAno} zona={zona} />
          </div>
          <div className="lg:col-span-2">
            <AlertasCriticosPanel
              alertas={kpis?.alertas_criticos}
              loading={kpisLoading}
              mesAno={mesAno}
            />
          </div>
        </div>

        {/* Tendência + Top5 a largura completa */}
        <TendenciaPerdas mesAno={mesAno} zona={zona} />
        <Top5Transformadores mesAno={mesAno} />

        <TabelaAlertas mesAno={mesAno} zona={zona} />
      </main>
    </div>
  );
}
