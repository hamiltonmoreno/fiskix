"use client";

import { useState } from "react";
import { KPICards } from "@/modules/dashboard/components/KPICards";
import { HeatMap } from "@/modules/dashboard/components/HeatMap";
import { Top5Transformadores } from "@/modules/dashboard/components/Top5Transformadores";
import { TabelaAlertas } from "@/modules/dashboard/components/TabelaAlertas";
import { useKPIs } from "@/modules/dashboard/hooks/useKPIs";
import { getCurrentMesAno } from "@/lib/utils";
import { LogOut, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isAdmin =
    profile.role === "admin_fiskix" || profile.role === "gestor_perdas";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Fiskix</span>
              <span className="text-xs text-slate-400 ml-2">Electra Cabo Verde</span>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <select
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

            <select
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

          {/* User menu */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden md:block">
              {profile.nome_completo}
            </span>
            {isAdmin && (
              <Link
                href="/admin"
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                title="Administração"
              >
                <Settings className="w-4 h-4" />
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <KPICards data={kpis} loading={kpisLoading} />

        {/* Mapa + Top 5 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <HeatMap mesAno={mesAno} zona={zona} />
          <Top5Transformadores mesAno={mesAno} />
        </div>

        {/* Tabela de Alertas */}
        <TabelaAlertas mesAno={mesAno} zona={zona} />
      </main>
    </div>
  );
}
