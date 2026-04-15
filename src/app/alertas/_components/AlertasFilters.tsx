"use client";

import { RefreshCw, FileDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMesAno } from "@/lib/utils";

interface AlertasFiltersProps {
  mesAno: string;
  statusFilter: string;
  zona: string;
  zonas: string[];
  hasAlertas: boolean;
  onMesAnoChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onZonaChange: (value: string) => void;
  onExport: () => void;
  onRefresh: () => void;
}

export function AlertasFilters({
  mesAno,
  statusFilter,
  zona,
  zonas,
  hasAlertas,
  onMesAnoChange,
  onStatusChange,
  onZonaChange,
  onExport,
  onRefresh,
}: AlertasFiltersProps) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
          Gestão · {formatMesAno(mesAno)}
        </p>
        <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
          Alertas de Fraude
        </h1>
      </div>

      <div className="flex items-center gap-2 no-print">
        <input
          type="month"
          value={mesAno}
          onChange={(e) => onMesAnoChange(e.target.value)}
          aria-label="Selecionar mês"
          className="px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
        />
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold h-auto border-none ring-0 focus:ring-0 hover:bg-surface-container transition-colors [&>svg]:hidden">
            <SelectValue placeholder="Todos os estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Notificado_SMS">SMS Enviado</SelectItem>
            <SelectItem value="Pendente_Inspecao">Em Inspeção</SelectItem>
            <SelectItem value="Inspecionado">Inspecionado</SelectItem>
            <SelectItem value="Fraude_Confirmada">Fraude Confirmada</SelectItem>
            <SelectItem value="Anomalia_Tecnica">Anomalia Técnica</SelectItem>
            <SelectItem value="Falso_Positivo">Falso Positivo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zona} onValueChange={onZonaChange}>
          <SelectTrigger className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold h-auto border-none ring-0 focus:ring-0 hover:bg-surface-container transition-colors [&>svg]:hidden">
            <SelectValue placeholder="Todas as zonas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as zonas</SelectItem>
            {zonas.map((z) => (
              <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={onExport}
          disabled={!hasAlertas}
          aria-label="Exportar para Excel"
          className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low disabled:opacity-40 cursor-pointer touch-manipulation transition-colors"
          title="Exportar Excel"
        >
          <FileDown className="w-4 h-4" />
        </button>
        <button
          onClick={onRefresh}
          aria-label="Atualizar alertas"
          className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low cursor-pointer touch-manipulation transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
