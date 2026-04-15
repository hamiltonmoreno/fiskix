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
      {/* ── Page Hero ── */}
      <div className="px-8 pt-8 pb-6 no-print">
        <div className="grid grid-cols-12 gap-6 items-end mb-8">
          <div className="col-span-12 lg:col-span-8">
            <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
              Electra · Cabo Verde
            </p>
            <h1 className="text-[2.5rem] font-bold text-on-surface tracking-tighter leading-tight">
              {greeting}, {firstName}
            </h1>
            <p className="mt-2 text-on-surface-variant text-base leading-relaxed">
              Visão geral do sistema de fiscalização de perdas e alertas de fraude.
            </p>
          </div>

          {/* ── Filter pill bar ── */}
          <div className="col-span-12 lg:col-span-4 flex items-center justify-end">
            <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-2xl">
              <Select value={mesAno} onValueChange={setMesAno}>
                <SelectTrigger className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl shadow-sm border-none h-auto text-xs font-medium text-on-surface ring-0 focus:ring-0 [&>svg]:hidden">
                  <Icon name="calendar_today" size="xs" className="text-primary" />
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
                <SelectTrigger className="flex items-center gap-1.5 px-3 py-2 text-on-surface-variant hover:text-on-surface border-none h-auto text-xs font-medium ring-0 focus:ring-0 bg-transparent [&>svg]:hidden">
                  <Icon name="filter_list" size="xs" />
                  <SelectValue placeholder="Zona" />
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
      </div>

      {/* ── Bento grid ── */}
      <main className="px-8 pb-12" id="alertas">
        {/* KPIs */}
        <KPICards data={kpis} loading={kpisLoading} />

        {/* Row 2: mapa + alertas críticos */}
        <div className="grid grid-cols-12 gap-6 mt-6">
          <div className="col-span-12 lg:col-span-8">
            <HeatMap mesAno={mesAno} zona={zona} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <AlertasCriticosPanel
              alertas={kpis?.alertas_criticos}
              loading={kpisLoading}
              mesAno={mesAno}
            />
          </div>
        </div>

        {/* Row 3: tendência + top5 */}
        <div className="grid grid-cols-12 gap-6 mt-6">
          <div className="col-span-12 xl:col-span-7">
            <TendenciaPerdas mesAno={mesAno} zona={zona} />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <Top5Transformadores mesAno={mesAno} />
          </div>
        </div>

        {/* Row 4: tabela completa */}
        <div className="mt-6">
          <TabelaAlertas mesAno={mesAno} zona={zona} />
        </div>
      </main>
    </div>
  );
}
