"use client";

import { formatMesAno } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import { DropdownFilter } from "@/components/mosaic/DropdownFilter";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface AlertasFiltersProps {
  mesAno: string;
  statusFilter: string;
  zona: string;
  zonas: string[];
  search: string;
  hasAlertas: boolean;
  defaultMesAno: string;
  onMesAnoChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onZonaChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  onExport: () => void;
  onRefresh: () => void;
}

export function AlertasFilters({
  mesAno,
  statusFilter,
  zona,
  zonas,
  search,
  hasAlertas,
  defaultMesAno,
  onMesAnoChange,
  onStatusChange,
  onZonaChange,
  onSearchChange,
  onClear,
  onExport,
  onRefresh,
}: AlertasFiltersProps) {
  const isFiltered = mesAno !== defaultMesAno || statusFilter !== "todos" || zona !== "todas" || search !== "";

  return (
    <div className="mb-8">
      <div className="sm:flex sm:justify-between sm:items-start mb-4">
        {/* Left: Title */}
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Alertas de Fraude
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestão · {formatMesAno(mesAno)}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
        <div className="relative">
          <input
            type="month"
            value={mesAno}
            onChange={(e) => onMesAnoChange(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <Icon name="arrow_drop_down" size="xs" className="text-gray-400" />
          </div>
        </div>

        {/* Mosaic Dropdown approach replacing Shadcn Select */}
        <select
          value={statusFilter}
          onChange={(e) => { haptics.light(); onStatusChange(e.target.value); }}
          className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer"
        >
          <option value="todos">Todos os estados</option>
          <option value="Pendente">Pendente</option>
          <option value="Notificado_SMS">SMS Enviado</option>
          <option value="Pendente_Inspecao">Em Inspeção</option>
          <option value="Inspecionado">Inspecionado</option>
          <option value="Fraude_Confirmada">Fraude Confirmada</option>
          <option value="Anomalia_Tecnica">Anomalia Técnica</option>
          <option value="Falso_Positivo">Falso Positivo</option>
        </select>

        <select
          value={zona}
          onChange={(e) => { haptics.light(); onZonaChange(e.target.value); }}
          className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-0 transition-colors cursor-pointer sm:max-w-[140px] sm:truncate"
        >
          <option value="todas">Todas as zonas</option>
          {zonas.map((z) => (
            <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
          ))}
        </select>

        {isFiltered && (
          <button
            onClick={() => { haptics.light(); onClear(); }}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            title="Limpar filtros"
          >
            Limpar
          </button>
        )}

        <button
          onClick={() => { haptics.light(); onExport(); }}
          disabled={!hasAlertas}
          aria-label="Exportar para Excel"
          className="p-2 border border-gray-200 dark:border-gray-700/60 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors disabled:opacity-40"
          title="Exportar Excel"
        >
          <Icon name="download" size="xs" />
        </button>

        <button
          onClick={() => { haptics.light(); onRefresh(); }}
          aria-label="Atualizar alertas"
          className="p-2 border border-gray-200 dark:border-gray-700/60 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          title="Atualizar"
        >
          <Icon name="refresh" size="xs" />
        </button>
      </div>
    </div>

      {/* Search bar */}
      <div className="relative">
        <Icon name="search" size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Pesquisar por nome do titular ou número de contador…"
          className="w-full pl-9 pr-9 py-2.5 border border-gray-200 dark:border-gray-700/60 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Limpar pesquisa"
          >
            <Icon name="close" size="xs" />
          </button>
        )}
      </div>
    </div>
  );
}
