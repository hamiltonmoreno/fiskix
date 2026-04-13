"use client";

import { useState, useMemo, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { FileDown, Printer, Calendar, X } from "lucide-react";
import { getCurrentMesAno, getLastNMonths } from "@/lib/utils";
import { exportToExcel, type ExportRow } from "@/lib/export";
import type { RelatoriosFiltros, Periodo, TipoTarifa } from "@/modules/relatorios/types";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const tabSkeleton = () => <Skeleton className="h-96 w-full rounded-[1.5rem] mt-4" />;

const TabExecutivo = dynamic(
  () => import("@/modules/relatorios/components/TabExecutivo").then((m) => m.TabExecutivo),
  { ssr: false, loading: tabSkeleton }
);
const TabInspecoes = dynamic(
  () => import("@/modules/relatorios/components/TabInspecoes").then((m) => m.TabInspecoes),
  { ssr: false, loading: tabSkeleton }
);
const TabPerdasZona = dynamic(
  () => import("@/modules/relatorios/components/TabPerdasZona").then((m) => m.TabPerdasZona),
  { ssr: false, loading: tabSkeleton }
);
const TabRecidivismo = dynamic(
  () => import("@/modules/relatorios/components/TabRecidivismo").then((m) => m.TabRecidivismo),
  { ssr: false, loading: tabSkeleton }
);
const TabBalancoEnergetico = dynamic(
  () => import("@/modules/relatorios/components/TabBalancoEnergetico").then((m) => m.TabBalancoEnergetico),
  { ssr: false, loading: tabSkeleton }
);
const TabAnaliseAvancada = dynamic(
  () => import("@/modules/relatorios/components/TabAnaliseAvancada").then((m) => m.TabAnaliseAvancada),
  { ssr: false, loading: tabSkeleton }
);
const TabGerarRelatorio = dynamic(
  () => import("@/modules/relatorios/components/TabGerarRelatorio").then((m) => m.TabGerarRelatorio),
  { ssr: false, loading: tabSkeleton }
);

type TabId = "executivo" | "inspecoes" | "perdas-zona" | "recidivismo" | "balanco" | "analise-avancada" | "gerar";

const TAB_DEFS: { value: TabId; label: string }[] = [
  { value: "executivo", label: "Executivo" },
  { value: "inspecoes", label: "Inspeções" },
  { value: "perdas-zona", label: "Perdas por Zona" },
  { value: "recidivismo", label: "Recidivismo" },
  { value: "balanco", label: "Balanço Energético" },
  { value: "analise-avancada", label: "Análise Avançada" },
  { value: "gerar", label: "Gerar Relatório" },
];

const ZONAS = [
  "Achada Santo António",
  "Achada Grande",
  "Várzea",
  "Palmarejo",
  "Plateau",
  "Tira Chapéu",
  "Terra Branca",
];

interface RelatoriosClientProps {
  profile: {
    role: string;
    nome_completo: string;
    id_zona: string | null;
  };
}

export function RelatoriosClient({ profile }: RelatoriosClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("executivo");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [mesAno, setMesAno] = useState(getCurrentMesAno());
  const [zona, setZona] = useState<string | undefined>(undefined);
  const [tipoTarifa, setTipoTarifa] = useState<TipoTarifa | undefined>(undefined);

  const [agendarOpen, setAgendarOpen] = useState(false);
  const [agendarEmail, setAgendarEmail] = useState("");
  const [agendarFreq, setAgendarFreq] = useState("mensal");
  const [agendarSuccess, setAgendarSuccess] = useState(false);

  const [exportPayload, setExportPayload] = useState<{
    headers: string[];
    rows: ExportRow[];
  } | null>(null);

  const filtros: RelatoriosFiltros = useMemo(
    () => ({ periodo, mesAno, zona, tipoTarifa }),
    [periodo, mesAno, zona, tipoTarifa]
  );

  const handleExportReady = useCallback(
    (headers: string[], rows: ExportRow[]) => {
      setExportPayload({ headers, rows });
    },
    []
  );

  function handleExportExcel() {
    if (!exportPayload) return;
    exportToExcel(`relatorio_${activeTab}_${mesAno}`, exportPayload.headers, exportPayload.rows);
  }

  function handleAgendarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAgendarSuccess(true);
  }

  const mesesDisponiveis = getLastNMonths(24);

  return (
    <div className="min-h-screen bg-background">

      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as TabId);
          setExportPayload(null);
        }}
      >
        {/* Page hero + filter bar */}
        <div className="px-8 pt-8 pb-0 no-print">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
                Análise · {profile.nome_completo}
              </p>
              <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
                Relatórios
              </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={!exportPayload}
                aria-label="Exportar relatório em Excel"
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low disabled:opacity-40 cursor-pointer touch-manipulation transition-colors"
                title="Exportar Excel"
              >
                <FileDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => window.print()}
                aria-label="Imprimir ou exportar PDF"
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low cursor-pointer touch-manipulation transition-colors"
                title="Imprimir / PDF"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setAgendarOpen(true); setAgendarSuccess(false); }}
                aria-label="Agendar envio de relatório"
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer touch-manipulation"
              >
                <Calendar className="w-3.5 h-3.5" />
                Agendar
              </button>
            </div>
          </div>

          {/* Filter pill row */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              className="px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-primary/30 h-9 cursor-pointer"
            >
              <option value="mes">Este mês</option>
              <option value="trimestre">Trimestre</option>
              <option value="semestre">Semestre</option>
              <option value="ano">Ano completo</option>
            </select>

            <select
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-primary/30 h-9 cursor-pointer"
            >
              {mesesDisponiveis.map((m) => {
                const [year, month] = m.split("-");
                const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("pt-CV", {
                  month: "short",
                  year: "numeric",
                });
                return (
                  <option key={m} value={m}>{label}</option>
                );
              })}
            </select>

            <select
              value={zona ?? ""}
              onChange={(e) => setZona(e.target.value || undefined)}
              className="px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-primary/30 h-9 cursor-pointer"
            >
              <option value="">Todas as zonas</option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>

            <select
              value={tipoTarifa ?? ""}
              onChange={(e) => setTipoTarifa((e.target.value || undefined) as TipoTarifa | undefined)}
              className="px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-primary/30 h-9 cursor-pointer"
            >
              <option value="">Todas as tarifas</option>
              <option value="Residencial">Residencial</option>
              <option value="Comercial">Comercial</option>
              <option value="Industrial">Industrial</option>
              <option value="Servicos_Publicos">Serviços Públicos</option>
            </select>
          </div>

          {/* Tab list */}
          <Tabs.List className="flex gap-1 overflow-x-auto">
            {TAB_DEFS.map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="px-4 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-colors focus:outline-none
                  data-[state=active]:bg-surface-container-lowest data-[state=active]:text-on-surface data-[state=active]:shadow-sm
                  data-[state=inactive]:text-on-surface-variant data-[state=inactive]:hover:text-on-surface data-[state=inactive]:hover:bg-surface-container-lowest/50"
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        {/* Tab content */}
        <div className="px-8 pb-12 pt-0">
          <div className="bg-surface-container-lowest rounded-b-[1.5rem] rounded-tr-[1.5rem] shadow-sm overflow-hidden">
            <div className="p-6">
              <Tabs.Content value="executivo" className="focus:outline-none">
                <TabExecutivo filtros={filtros} active={activeTab === "executivo"} onExportReady={handleExportReady} />
              </Tabs.Content>

              <Tabs.Content value="inspecoes" className="focus:outline-none">
                <TabInspecoes filtros={filtros} active={activeTab === "inspecoes"} onExportReady={handleExportReady} />
              </Tabs.Content>

              <Tabs.Content value="perdas-zona" className="focus:outline-none">
                <TabPerdasZona filtros={filtros} active={activeTab === "perdas-zona"} onExportReady={handleExportReady} />
              </Tabs.Content>

              <Tabs.Content value="recidivismo" className="focus:outline-none">
                <TabRecidivismo filtros={filtros} active={activeTab === "recidivismo"} onExportReady={handleExportReady} />
              </Tabs.Content>

              <Tabs.Content value="balanco" className="focus:outline-none">
                <TabBalancoEnergetico filtros={filtros} active={activeTab === "balanco"} onExportReady={handleExportReady} />
              </Tabs.Content>

              <Tabs.Content value="analise-avancada" className="focus:outline-none">
                <TabAnaliseAvancada filtros={filtros} active={activeTab === "analise-avancada"} onExportReady={handleExportReady} />
              </Tabs.Content>

              <Tabs.Content value="gerar" className="focus:outline-none">
                <TabGerarRelatorio filtros={filtros} active={activeTab === "gerar"} onExportReady={handleExportReady} />
              </Tabs.Content>
            </div>
          </div>
        </div>
      </Tabs.Root>

      {/* Agendar Envio modal */}
      <Dialog.Root open={agendarOpen} onOpenChange={setAgendarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-container-lowest rounded-[1.5rem] shadow-xl w-full max-w-md p-6 z-50 focus:outline-none">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-base font-bold text-on-surface">
                Agendar Envio de Relatório
              </Dialog.Title>
              <Dialog.Close className="p-1.5 rounded-full hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            {agendarSuccess ? (
              <div className="p-4 bg-emerald-50 rounded-xl text-sm text-emerald-700">
                Envio agendado para{" "}
                <strong>{agendarEmail}</strong> com frequência <strong>{agendarFreq}</strong>.
              </div>
            ) : (
              <form onSubmit={handleAgendarSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={agendarEmail}
                    onChange={(e) => setAgendarEmail(e.target.value)}
                    placeholder="diretor@electra.cv"
                    className="w-full text-sm bg-surface-container-low rounded-xl px-4 py-2.5 text-on-surface placeholder:text-on-surface-variant/50 border-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Frequência
                  </label>
                  <select
                    value={agendarFreq}
                    onChange={(e) => setAgendarFreq(e.target.value)}
                    className="w-full text-sm bg-surface-container-low rounded-xl px-4 py-2.5 text-on-surface border-none focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                  >
                    <option value="semanal">Semanal (toda segunda-feira)</option>
                    <option value="mensal">Mensal (dia 1 de cada mês)</option>
                    <option value="trimestral">Trimestral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Relatório
                  </label>
                  <div className="text-sm text-on-surface bg-surface-container-low rounded-xl px-4 py-2.5">
                    {TAB_DEFS.find((t) => t.value === activeTab)?.label ?? "Executivo"}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Dialog.Close className="flex-1 px-4 py-2 text-sm font-bold bg-surface-container-low text-on-surface-variant rounded-full hover:bg-surface-container transition-colors cursor-pointer">
                    Cancelar
                  </Dialog.Close>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-full transition-colors cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
