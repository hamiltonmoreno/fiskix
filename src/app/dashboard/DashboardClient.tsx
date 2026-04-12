"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { KPICards } from "@/modules/dashboard/components/KPICards";
import { TabelaAlertas } from "@/modules/dashboard/components/TabelaAlertas";
import { AlertasCriticosPanel } from "@/modules/dashboard/components/AlertasCriticosPanel";
import { useKPIs } from "@/modules/dashboard/hooks/useKPIs";
import { getCurrentMesAno } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HeatMap = dynamic(
  () => import("@/modules/dashboard/components/HeatMap").then((m) => m.HeatMap),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-xl" /> }
);
const Top5Transformadores = dynamic(
  () => import("@/modules/dashboard/components/Top5Transformadores").then((m) => m.Top5Transformadores),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-xl" /> }
);
const TendenciaPerdas = dynamic(
  () => import("@/modules/dashboard/components/TendenciaPerdas").then((m) => m.TendenciaPerdas),
  { ssr: false, loading: () => <Skeleton className="h-48 rounded-xl" /> }
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
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="bg-card border-b border-border sticky top-0 z-30 no-print">
        <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold text-foreground hidden sm:block">
            Dashboard
          </h1>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={mesAno} onValueChange={setMesAno}>
              <SelectTrigger className="w-44 h-9 text-sm">
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
              <SelectTrigger className="w-44 h-9 text-sm">
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

          <span className="text-sm text-muted-foreground hidden lg:block whitespace-nowrap">
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

        <TendenciaPerdas mesAno={mesAno} zona={zona} />
        <Top5Transformadores mesAno={mesAno} />

        <TabelaAlertas mesAno={mesAno} zona={zona} />
      </main>
    </div>
  );
}
