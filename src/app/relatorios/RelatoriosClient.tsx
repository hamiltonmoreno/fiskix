"use client";

import { useState, useMemo, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "@/components/Icon";
import { getCurrentMesAno, getLastNMonths } from "@/lib/utils";
import { exportToExcel, type ExportRow } from "@/lib/export";
import type { RelatoriosFiltros, Periodo, TipoTarifa } from "@/modules/relatorios/types";
import { haptics } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const tabSkeleton = () => <Skeleton className="h-96 w-full rounded-2xl mt-4" />;

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
  const supabase = useMemo(() => createClient(), []);
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

  async function handleAgendarSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const valor = JSON.stringify({ email: agendarEmail, frequencia: agendarFreq, ativo: true, criado_em: new Date().toISOString() });
      const { error } = await supabase
        .from("configuracoes")
        .upsert({ chave: "relatorio_schedule", valor }, { onConflict: "chave" });
      if (error) throw error;
      setAgendarSuccess(true);
      toast.success(`Agendamento guardado: relatório ${agendarFreq} para ${agendarEmail}`);
    } catch {
      toast.error("Falha ao guardar agendamento. Tente novamente.");
    }
  }

  const mesesDisponiveis = getLastNMonths(24);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => {
          haptics.light();
          setActiveTab(v as TabId);
          setExportPayload(null);
        }}
      >
        {/* Page hero + filter bar */}
        <div className="pb-0 no-print">
          <div className="sm:flex sm:justify-between sm:items-center mb-8">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                Relatórios
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Análise · {profile.nome_completo}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { haptics.light(); handleExportExcel(); }}
                disabled={!exportPayload}
                aria-label="Exportar relatório em Excel"
                className="p-2 border border-gray-200 dark:border-gray-700/60 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors disabled:opacity-40 shadow-sm"
                title="Exportar Excel"
              >
                <Icon name="download" size="xs" />
              </button>
              <button
                onClick={() => { haptics.light(); window.print(); }}
                aria-label="Imprimir ou exportar PDF"
                className="p-2 border border-gray-200 dark:border-gray-700/60 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm"
                title="Imprimir / PDF"
              >
                <Icon name="print" size="xs" />
              </button>
              <button
                onClick={() => window.print()}
                aria-label="Imprimir ou exportar PDF"
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low cursor-pointer touch-manipulation transition-colors"
                title="Imprimir / PDF"
              >
                <Icon name="print" size="sm" />
              </button>
              <button
                onClick={() => { haptics.medium(); setAgendarOpen(true); setAgendarSuccess(false); }}
                aria-label="Agendar envio de relatório"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Icon name="event" size="xs" />
                Agendar
              </button>
            </div>
          </div>

          {/* Filter pill row */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <select
              value={periodo}
              onChange={(e) => { haptics.light(); setPeriodo(e.target.value as Periodo); }}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer"
            >
              <option value="mes">Este mês</option>
              <option value="trimestre">Trimestre</option>
              <option value="semestre">Semestre</option>
              <option value="ano">Ano completo</option>
            </select>

            <select
              value={mesAno}
              onChange={(e) => { haptics.light(); setMesAno(e.target.value); }}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer"
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
              onChange={(e) => { haptics.light(); setZona(e.target.value || undefined); }}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer"
            >
              <option value="">Todas as zonas</option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>

            <select
              value={tipoTarifa ?? ""}
              onChange={(e) => { haptics.light(); setTipoTarifa((e.target.value || undefined) as TipoTarifa | undefined); }}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer"
            >
              <option value="">Todas as tarifas</option>
              <option value="Residencial">Residencial</option>
              <option value="Comercial">Comercial</option>
              <option value="Industrial">Industrial</option>
              <option value="Servicos_Publicos">Serviços Públicos</option>
            </select>
          </div>

          {/* Tab list */}
          <Tabs.List className="flex gap-1 overflow-x-auto pb-px scrollbar-hide border-b border-gray-200 dark:border-gray-700/60 mb-6">
            {TAB_DEFS.map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none
                  data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400
                  data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gray-900 dark:data-[state=inactive]:hover:text-gray-100"
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        {/* Tab content */}
        <div className="pb-12 pt-0 w-full mb-8">
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover w-full min-h-[400px]">
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

      <Dialog.Root open={agendarOpen} onOpenChange={setAgendarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 dark:bg-gray-900/60 backdrop-blur-sm z-50 transition-all duration-300" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700/60 w-full max-w-md p-6 z-50 focus:outline-none">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Agendar Envio de Relatório
              </Dialog.Title>
              <Dialog.Close className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors cursor-pointer">
                <Icon name="close" size="xs" />
              </Dialog.Close>
            </div>

            {agendarSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-sm text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                Envio agendado para{" "}
                <strong className="font-semibold">{agendarEmail}</strong> com frequência <strong className="font-semibold">{agendarFreq}</strong>.
              </div>
            ) : (
              <form onSubmit={handleAgendarSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={agendarEmail}
                    onChange={(e) => setAgendarEmail(e.target.value)}
                    placeholder="diretor@electra.cv"
                    className="w-full text-sm bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Frequência
                  </label>
                  <select
                    value={agendarFreq}
                    onChange={(e) => setAgendarFreq(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer transition-shadow"
                  >
                    <option value="semanal">Semanal (toda segunda-feira)</option>
                    <option value="mensal">Mensal (dia 1 de cada mês)</option>
                    <option value="trimestral">Trimestral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Relatório
                  </label>
                  <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700/60">
                    {TAB_DEFS.find((t) => t.value === activeTab)?.label ?? "Executivo"}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Dialog.Close className="flex-1 px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                    Cancelar
                  </Dialog.Close>
                  <button
                    type="submit"
                    onClick={() => haptics.medium()}
                    className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
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
