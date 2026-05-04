/**
 * Pure functions for the Balanço Energético module.
 *
 * Computes injected vs invoiced energy per substation and detects technical
 * (grid losses) vs commercial losses (fraud / unmetered consumption).
 */

export interface InjecaoRow {
  id_subestacao: string;
  mes_ano: string;
  total_kwh_injetado: number;
  subestacao?: { nome: string; ilha: string; zona_bairro: string } | null;
}

export interface FaturacaoRow {
  mes_ano: string;
  kwh_faturado: number;
  valor_cve: number;
  cliente?: {
    id?: string;
    id_subestacao: string;
    tipo_tarifa?: string;
    nome_titular?: string;
    numero_contador?: string;
  } | null;
}

export interface SubestacaoBalancoRow {
  id: string;
  nome: string;
  ilha: string;
  zona_bairro: string;
  kwh_injetado: number;
  kwh_faturado: number;
  perda_kwh: number;
  perda_pct: number;
  cve_estimado: number;
  /** Heuristic split: any loss above the technical threshold is treated as commercial. */
  perda_tecnica_kwh: number;
  perda_comercial_kwh: number;
  classificacao: "ok" | "atencao" | "critico";
}

export interface EvolucaoMensalRow {
  mes_ano: string;
  kwh_injetado: number;
  kwh_faturado: number;
  perda_kwh: number;
  perda_pct: number;
}

export interface BalancoKPIs {
  totalInjetado: number;
  totalFaturado: number;
  perdaKwh: number;
  perdaPct: number;
  perdaTecnicaKwh: number;
  perdaComercialKwh: number;
  cveEstimado: number;
  subestacoesCriticas: number;
}

export interface ClienteContribuidor {
  id_cliente: string;
  nome_titular: string;
  numero_contador: string;
  kwh_faturado: number;
  share_pct: number;
}

export const DEFAULT_TECH_LOSS_PCT = 8;
export const DEFAULT_PRICE_CVE_PER_KWH = 15;
export const DEFAULT_ATENCAO_PCT = 15;
export const DEFAULT_CRITICO_PCT = 25;

export interface BalancoOptions {
  /** Below this %, all loss is treated as technical. Above, the excess is commercial. */
  tecnicoMaxPct?: number;
  /** Price per kWh in CVE for monetary estimates. */
  precoCvePorKwh?: number;
  /** Loss % threshold for "atencao" classification. */
  atencaoPct?: number;
  /** Loss % threshold for "critico" classification. */
  criticoPct?: number;
  /** Optional zona filter applied after aggregation. */
  zona?: string;
  /** Optional tarifa filter applied to invoicing rows before aggregation. */
  tipoTarifa?: string;
}

function classify(
  perdaPct: number,
  atencao = DEFAULT_ATENCAO_PCT,
  critico = DEFAULT_CRITICO_PCT,
): SubestacaoBalancoRow["classificacao"] {
  if (perdaPct >= critico) return "critico";
  if (perdaPct >= atencao) return "atencao";
  return "ok";
}

function splitLosses(perdaKwh: number, injetado: number, tecnicoMaxPct: number) {
  const tecnicaCap = injetado * (tecnicoMaxPct / 100);
  const tecnica = Math.min(perdaKwh, tecnicaCap);
  const comercial = Math.max(0, perdaKwh - tecnica);
  return { tecnica, comercial };
}

export function calcularBalancoPorSubestacao(
  injecoes: InjecaoRow[],
  faturacoes: FaturacaoRow[],
  opts: BalancoOptions = {},
): SubestacaoBalancoRow[] {
  const tecnicoMaxPct = opts.tecnicoMaxPct ?? DEFAULT_TECH_LOSS_PCT;
  const preco = opts.precoCvePorKwh ?? DEFAULT_PRICE_CVE_PER_KWH;
  const atencao = opts.atencaoPct ?? DEFAULT_ATENCAO_PCT;
  const critico = opts.criticoPct ?? DEFAULT_CRITICO_PCT;

  const inj: Record<string, { kwh: number; nome: string; ilha: string; zona: string }> = {};
  for (const r of injecoes) {
    if (!inj[r.id_subestacao]) {
      inj[r.id_subestacao] = {
        kwh: 0,
        nome: r.subestacao?.nome ?? "Desconhecida",
        ilha: r.subestacao?.ilha ?? "—",
        zona: r.subestacao?.zona_bairro ?? "—",
      };
    }
    inj[r.id_subestacao].kwh += r.total_kwh_injetado;
  }

  const fat: Record<string, number> = {};
  for (const r of faturacoes) {
    if (opts.tipoTarifa && r.cliente?.tipo_tarifa !== opts.tipoTarifa) continue;
    const subId = r.cliente?.id_subestacao ?? "";
    if (!subId) continue;
    fat[subId] = (fat[subId] ?? 0) + r.kwh_faturado;
  }

  const rows: SubestacaoBalancoRow[] = Object.entries(inj).map(([id, info]) => {
    const injKwh = info.kwh;
    const faturadoKwh = fat[id] ?? 0;
    const perdaKwh = Math.max(0, injKwh - faturadoKwh);
    const perdaPct = injKwh > 0 ? (perdaKwh / injKwh) * 100 : 0;
    const { tecnica, comercial } = splitLosses(perdaKwh, injKwh, tecnicoMaxPct);
    return {
      id,
      nome: info.nome,
      ilha: info.ilha,
      zona_bairro: info.zona,
      kwh_injetado: Math.round(injKwh),
      kwh_faturado: Math.round(faturadoKwh),
      perda_kwh: Math.round(perdaKwh),
      perda_pct: Math.round(perdaPct * 10) / 10,
      cve_estimado: Math.round(perdaKwh * preco),
      perda_tecnica_kwh: Math.round(tecnica),
      perda_comercial_kwh: Math.round(comercial),
      classificacao: classify(perdaPct, atencao, critico),
    };
  });

  const filtered = opts.zona ? rows.filter((r) => r.zona_bairro === opts.zona) : rows;
  return filtered.sort((a, b) => b.perda_kwh - a.perda_kwh);
}

export function calcularEvolucaoMensal(
  injecoes: InjecaoRow[],
  faturacoes: FaturacaoRow[],
  meses: string[],
  opts: BalancoOptions = {},
): EvolucaoMensalRow[] {
  const injMap: Record<string, number> = {};
  for (const r of injecoes) {
    if (opts.zona && r.subestacao?.zona_bairro !== opts.zona) continue;
    injMap[r.mes_ano] = (injMap[r.mes_ano] ?? 0) + r.total_kwh_injetado;
  }

  const fatMap: Record<string, number> = {};
  for (const r of faturacoes) {
    if (opts.tipoTarifa && r.cliente?.tipo_tarifa !== opts.tipoTarifa) continue;
    fatMap[r.mes_ano] = (fatMap[r.mes_ano] ?? 0) + r.kwh_faturado;
  }

  return meses.map((m) => {
    const inj = injMap[m] ?? 0;
    const fat = fatMap[m] ?? 0;
    const perda = Math.max(0, inj - fat);
    const pct = inj > 0 ? (perda / inj) * 100 : 0;
    return {
      mes_ano: m,
      kwh_injetado: Math.round(inj),
      kwh_faturado: Math.round(fat),
      perda_kwh: Math.round(perda),
      perda_pct: Math.round(pct * 100) / 100,
    };
  });
}

export function agregarKPIs(
  porSubestacao: SubestacaoBalancoRow[],
  opts: BalancoOptions = {},
): BalancoKPIs {
  const preco = opts.precoCvePorKwh ?? DEFAULT_PRICE_CVE_PER_KWH;
  const totalInjetado = porSubestacao.reduce((s, r) => s + r.kwh_injetado, 0);
  const totalFaturado = porSubestacao.reduce((s, r) => s + r.kwh_faturado, 0);
  const perdaKwh = Math.max(0, totalInjetado - totalFaturado);
  const perdaPct = totalInjetado > 0 ? (perdaKwh / totalInjetado) * 100 : 0;
  const perdaTecnicaKwh = porSubestacao.reduce((s, r) => s + r.perda_tecnica_kwh, 0);
  const perdaComercialKwh = porSubestacao.reduce((s, r) => s + r.perda_comercial_kwh, 0);
  return {
    totalInjetado,
    totalFaturado,
    perdaKwh,
    perdaPct: Math.round(perdaPct * 10) / 10,
    perdaTecnicaKwh,
    perdaComercialKwh,
    cveEstimado: Math.round(perdaKwh * preco),
    subestacoesCriticas: porSubestacao.filter((r) => r.classificacao === "critico").length,
  };
}

export function topContribuidores(
  faturacoes: FaturacaoRow[],
  idSubestacao: string,
  injetadoSubestacao: number,
  limite = 5,
): ClienteContribuidor[] {
  const map: Record<string, ClienteContribuidor> = {};
  for (const r of faturacoes) {
    if (r.cliente?.id_subestacao !== idSubestacao) continue;
    const id = r.cliente?.id ?? r.cliente?.numero_contador ?? "—";
    if (!map[id]) {
      map[id] = {
        id_cliente: id,
        nome_titular: r.cliente?.nome_titular ?? "—",
        numero_contador: r.cliente?.numero_contador ?? "—",
        kwh_faturado: 0,
        share_pct: 0,
      };
    }
    map[id].kwh_faturado += r.kwh_faturado;
  }

  const list = Object.values(map);
  for (const c of list) {
    c.kwh_faturado = Math.round(c.kwh_faturado);
    c.share_pct = injetadoSubestacao > 0
      ? Math.round((c.kwh_faturado / injetadoSubestacao) * 1000) / 10
      : 0;
  }
  return list.sort((a, b) => b.kwh_faturado - a.kwh_faturado).slice(0, limite);
}
