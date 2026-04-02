import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata número em CVE (Escudo Cabo-Verdiano) */
export function formatCVE(value: number): string {
  return new Intl.NumberFormat("pt-CV", {
    style: "currency",
    currency: "CVE",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formata kWh com 2 casas decimais */
export function formatKWh(value: number): string {
  return new Intl.NumberFormat("pt-CV", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value) + " kWh";
}

/** Formata mes_ano de 'YYYY-MM' para 'Mês Ano' */
export function formatMesAno(mesAno: string): string {
  const [year, month] = mesAno.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("pt-CV", { month: "long", year: "numeric" });
}

/** Retorna cor do badge baseado no score */
export function getScoreColor(score: number): string {
  if (score >= 75) return "bg-red-100 text-red-800 border-red-200";
  if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-green-100 text-green-800 border-green-200";
}

/** Retorna label do score */
export function getScoreLabel(score: number): string {
  if (score >= 75) return "CRÍTICO";
  if (score >= 50) return "MÉDIO";
  return "BAIXO";
}

/** Gera array de meses dos últimos N meses no formato YYYY-MM */
export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}

/** Mês atual no formato YYYY-MM */
export function getCurrentMesAno(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
