import type { HistoricoRun } from "./types";

export const HISTORICO_KEY = "fiskix_scoring_historico";
export const MAX_HISTORICO = 10;

export function loadHistorico(): HistoricoRun[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORICO_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveHistorico(runs: HistoricoRun[]) {
  localStorage.setItem(HISTORICO_KEY, JSON.stringify(runs.slice(0, MAX_HISTORICO)));
}
