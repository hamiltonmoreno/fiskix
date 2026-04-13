"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { KPICards } from "@/modules/dashboard/components/KPICards";
import { TabelaAlertas } from "@/modules/dashboard/components/TabelaAlertas";
import { AlertasCriticosPanel } from "@/modules/dashboard/components/AlertasCriticosPanel";
import { useKPIs } from "@/modules/dashboard/hooks/useKPIs";
import { getCurrentMesAno } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/Icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HeatMap = dynamic(
  () => import("@/modules/dashboard/components/HeatMap").then((m) => m.HeatMap),
  { ssr: false, loading: () => <Skeleton className="h-80 rounded-2xl" /> }
);
const Top5Transformadores = dynamic(
  () => import("@/modules/dashboard/components/Top5Transformadores").then((m) => m.Top5Transformadores),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-2xl" /> }
);
const TendenciaPerdas = dynamic(
  () => import("@/modules/dashboard/components/TendenciaPerdas").then((m) => m.TendenciaPerdas),
  { ssr: false, loading: () => <Skeleton className="h-56 rounded-2xl" /> }
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

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const firstName = profile.nome_completo.split(" ")[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 no-print">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visão geral do sistema de fiscalização
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon name="calendar_today" size="xs" />
            </div>
            <Select value={mesAno} onValueChange={setMesAno}>
              <SelectTrigger className="w-44 h-9 text-sm rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {new Date(m + "-01").toLocaleDateString("pt-CV", {
                      month: "long",
                      year: "numeric",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={zona ?? "Todos"}
              onValueChange={(v) => setZona(v === "Todos" ? undefined : v)}
            >
              <SelectTrigger className="w-44 h-9 text-sm rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONAS.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z === "Todos" ? "Todas as zonas" : z.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main content — bento grid */}
      <main className="px-6 pb-8 space-y-4" id="alertas">
        {/* KPIs row */}
        <KPICards data={kpis} loading={kpisLoading} />

        {/* Row 2: mapa + alertas críticos */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
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

        {/* Row 3: tendência + top5 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <TendenciaPerdas mesAno={mesAno} zona={zona} />
          <Top5Transformadores mesAno={mesAno} />
        </div>

        {/* Row 4: tabela completa */}
        <TabelaAlertas mesAno={mesAno} zona={zona} />
      </main>
    </div>
  );
}
