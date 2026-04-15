import { getLastNMonths } from "@/lib/utils";
import type { RelatoriosFiltros, Periodo } from "../types";

export const PLATAFORMA_CUSTO_MENSAL = 500_000;

export function periodoToN(periodo: Periodo): number {
  return { mes: 1, trimestre: 3, semestre: 6, ano: 12 }[periodo];
}

export function getMesesRange(filtros: RelatoriosFiltros): string[] {
  const n = periodoToN(filtros.periodo);
  return getLastNMonths(Math.max(n, 12)).filter((m) => m <= filtros.mesAno).slice(-n);
}
