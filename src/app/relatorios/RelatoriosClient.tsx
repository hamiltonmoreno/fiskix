"use client";

import { useState, useMemo, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { FileDown, Printer, Calendar, X } from "lucide-react";
import { getCurrentMesAno, getLastNMonths } from "@/lib/utils";
import { exportToExcel, type ExportRow } from "@/lib/export";
import type { RelatoriosFiltros, Periodo, TipoTarifa } from "@/modules/relatorios/types";

import { TabExecutivo } from "@/modules/relatorios/components/TabExecutivo";
import { TabInspecoes } from "@/modules/relatorios/components/TabInspecoes";
import { TabPerdasZona } from "@/modules/relatorios/components/TabPerdasZona";
import { TabRecidivismo } from "@/modules/relatorios/components/TabRecidivismo";
import { TabBalancoEnergetico } from "@/modules/relatorios/components/TabBalancoEnergetico";
import { TabGerarRelatorio } from "@/modules/relatorios/components/TabGerarRelatorio";

type TabId = "executivo" | "inspecoes" | "perdas-zona" | "recidivismo" | "balanco" | "gerar";

const TAB_DEFS: { value: TabId; label: string }[] = [
  { value: "executivo", label: "Executivo" },
  { value: "inspecoes", label: "Inspeções" },
  { value: "perdas-zona", label: "Perdas por Zona" },
  { value: "recidivismo", label: "Recidivismo" },
  { value: "balanco", label: "Balanço Energético" },
  { value: "gerar", label: "+ Gerar Relatório" },
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

  // Agendar modal state
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [agendarEmail, setAgendarEmail] = useState("");
  const [agendarFreq, setAgendarFreq] = useState("mensal");
  const [agendarSuccess, setAgendarSuccess] = useState(false);

  // Export data registered by active tab
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

  // Generate last 24 months for the period dropdown
  const mesesDisponiveis = getLastNMonths(24);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 lg:top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-3 py-3">
          <h1 className="text-base font-semibold text-slate-900 mr-2">Relatórios</h1>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="mes">Este mês</option>
              <option value="trimestre">Trimestre</option>
              <option value="semestre">Semestre</option>
              <option value="ano">Ano completo</option>
            </select>

            <select
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {mesesDisponiveis.map((m) => {
                const [year, month] = m.split("-");
                const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("pt-CV", {
                  month: "short",
                  year: "numeric",
                });
                return (
                  <option key={m} value={m}>
                    {label}
                  </option>
                );
              })}
            </select>

            <select
              value={zona ?? ""}
              onChange={(e) => setZona(e.target.value || undefined)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Todas as zonas</option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>

            <select
              value={tipoTarifa ?? ""}
              onChange={(e) => setTipoTarifa((e.target.value || undefined) as TipoTarifa | undefined)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Todas as tarifas</option>
              <option value="Residencial">Residencial</option>
              <option value="Comercial">Comercial</option>
              <option value="Industrial">Industrial</option>
              <option value="Servicos_Publicos">Serviços Públicos</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!exportPayload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exportar dados como Excel"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Imprimir / Exportar PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={() => { setAgendarOpen(true); setAgendarSuccess(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Agendar Envio</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as TabId);
          setExportPayload(null);
        }}
      >
        <Tabs.List className="flex border-b border-slate-200 bg-white px-4 lg:px-6 sticky top-[57px] z-20 overflow-x-auto">
          {TAB_DEFS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                data-[state=active]:border-blue-600 data-[state=active]:text-blue-700
                data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-500
                hover:text-slate-700 focus:outline-none"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="p-4 lg:p-6">
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

          <Tabs.Content value="gerar" className="focus:outline-none">
            <TabGerarRelatorio filtros={filtros} active={activeTab === "gerar"} onExportReady={handleExportReady} />
          </Tabs.Content>
        </div>
      </Tabs.Root>

      {/* Agendar Envio modal */}
      <Dialog.Root open={agendarOpen} onOpenChange={setAgendarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-50 focus:outline-none">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Agendar Envio de Relatório
              </Dialog.Title>
              <Dialog.Close className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            {agendarSuccess ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Envio agendado com sucesso! O relatório será enviado para{" "}
                <strong>{agendarEmail}</strong> com frequência <strong>{agendarFreq}</strong>.
              </div>
            ) : (
              <form onSubmit={handleAgendarSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Endereço de email
                  </label>
                  <input
                    type="email"
                    required
                    value={agendarEmail}
                    onChange={(e) => setAgendarEmail(e.target.value)}
                    placeholder="diretor@electra.cv"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Frequência de envio
                  </label>
                  <select
                    value={agendarFreq}
                    onChange={(e) => setAgendarFreq(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="semanal">Semanal (toda segunda-feira)</option>
                    <option value="mensal">Mensal (dia 1 de cada mês)</option>
                    <option value="trimestral">Trimestral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Tipo de relatório
                  </label>
                  <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    {TAB_DEFS.find((t) => t.value === activeTab)?.label ?? "Executivo"}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Dialog.Close className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    Cancelar
                  </Dialog.Close>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
                  >
                    Confirmar Agendamento
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
