export type Periodo = "mes" | "trimestre" | "semestre" | "ano";

export type TipoTarifa =
  | "Residencial"
  | "Comercial"
  | "Industrial"
  | "Servicos_Publicos";

export interface RelatoriosFiltros {
  periodo: Periodo;
  mesAno: string; // YYYY-MM anchor month
  zona: string | undefined;
  tipoTarifa: TipoTarifa | undefined;
}

// ── Tab Executivo ──────────────────────────────────────────────────────────────

export interface ExecutivoPeriodoRow {
  mes: string; // formatted label e.g. "jan. 2025"
  mesRaw: string; // YYYY-MM
  perda: number; // CVE
  recuperado: number; // CVE
  roi: number; // CVE (recuperado - custo_plataforma)
  roiAcumulado: number; // CVE running sum
}

export interface ExecutivoKPIs {
  totalAlertas: number;
  fraudesConfirmadas: number;
  receitaRecuperada: number; // CVE
  taxaDetecao: number; // percentage 0-100
}

export interface ExecutivoData {
  kpis: ExecutivoKPIs;
  serie: ExecutivoPeriodoRow[];
}

// ── Tab Inspeções ──────────────────────────────────────────────────────────────

export interface InspecaoZonaRow {
  zona: string;
  confirmadas: number;
  anomalias: number;
  falsosPositivos: number;
  pendentes: number;
  total: number;
  taxaSucesso: number; // %
}

export interface InspecoesKPIs {
  total: number;
  confirmadas: number;
  falsosPositivos: number;
  taxaSucesso: number; // %
}

export interface InspecoesData {
  kpis: InspecoesKPIs;
  porZona: InspecaoZonaRow[];
  donut: Array<{ name: string; value: number; color: string }>;
}

// ── Tab Perdas por Zona ────────────────────────────────────────────────────────

export interface SubestacaoPerdasRow {
  id: string;
  nome: string;
  ilha: string;
  kwh_injetado: number;
  kwh_faturado: number;
  perda_kwh: number;
  perda_pct: number;
  cve_estimado: number;
}

export interface RadarIlhaRow {
  ilha: string;
  indice_risco: number; // 0-100
}

export interface PerdasZonaKPIs {
  totalInjetado: number; // kWh
  totalFaturado: number; // kWh
  perdaKwh: number;
  perdaPct: number;
}

export interface PerdasZonaData {
  kpis: PerdasZonaKPIs;
  top7: SubestacaoPerdasRow[];
  tabela: SubestacaoPerdasRow[];
  radarIlha: RadarIlhaRow[];
}

// ── Tab Recidivismo ────────────────────────────────────────────────────────────

export interface ReincidenteRow {
  id_cliente: string;
  nome_titular: string;
  numero_contador: string;
  tipo_tarifa: string;
  zona: string;
  total_alertas: number;
  confirmados: number;
  ultimo_mes: string; // formatted
}

export interface RecidivismoKPIs {
  totalReincidentes: number;
  mediaAlertas: number;
  taxaReincidencia: number; // %
  maxAlertas: number;
}

export interface RecidivismoData {
  kpis: RecidivismoKPIs;
  mensalNovos: Array<{ mes: string; novos: number }>;
  top10: ReincidenteRow[];
  tabela: ReincidenteRow[];
}

// ── Tab Análise Avançada ───────────────────────────────────────────────────────

export interface EficienciaSubRow {
  id: string;
  nome: string;
  zona_bairro: string;
  kwh_injetado: number;
  perda_kwh: number;
  perda_pct: number;
  perda_tecnica_kwh: number;
  perda_comercial_kwh: number;
  perda_comercial_pct: number;
  cve_comercial_estimado: number;
  irec: number; // índice de recuperabilidade 0-100
  alertas_alto_score: number;
  total_alertas: number;
}

export interface AnaliseAvancadaKPIs {
  perda_total_kwh: number;
  perda_tecnica_kwh: number;
  perda_comercial_kwh: number;
  perda_comercial_pct: number; // % da perda total que é comercial
  cve_comercial_estimado: number;
  perda_tecnica_estimada_pct: number; // limiar configurado (ex: 5%)
}

export interface AnaliseAvancadaData {
  kpis: AnaliseAvancadaKPIs;
  porSubestacao: EficienciaSubRow[];
  evolucaoComercial: Array<{ mes: string; pct_comercial: number; pct_tecnica: number }>;
}

// ── Tab Balanço Energético ─────────────────────────────────────────────────────

export interface BalancoSubRow {
  id: string;
  nome: string;
  ilha: string;
  kwh_injetado: number;
  kwh_faturado: number;
  perda_kwh: number;
  perda_pct: number;
  cve_estimado: number;
}

export interface BalancoKPIs {
  totalInjetado: number;
  totalFaturado: number;
  perdaKwh: number;
  perdaPct: number;
}

export interface BalancoEnergeticoData {
  kpis: BalancoKPIs;
  porSubestacao: BalancoSubRow[];
  evolucaoPerda: Array<{ mes: string; pct: number }>;
}
