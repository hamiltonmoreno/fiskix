/**
 * Pure helpers for the Balanço Energético edge function.
 *
 * Kept free of Deno- or Supabase-specific imports so the same module can be
 * unit-tested under Vitest in the Node toolchain.
 */

export const DEFAULT_TECH_LOSS_PCT = 8;
export const DEFAULT_PRICE_CVE_PER_KWH = 15;

export interface InjecaoRow {
  id_subestacao: string;
  mes_ano: string;
  total_kwh_injetado: number;
  subestacoes?: { nome: string; ilha: string; zona_bairro: string } | null;
}

export interface FaturacaoRow {
  mes_ano: string;
  kwh_faturado: number;
  clientes?: { id_subestacao: string; tipo_tarifa: string } | null;
}

export interface BalancoOpts {
  tipoTarifa?: string;
  zona?: string;
  tecnicoMaxPct: number;
  precoCvePorKwh: number;
}

export function shiftMesAno(mesAno: string, deltaMeses: number): string {
  const [y, m] = mesAno.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildMesesRange(anchor: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMesAno(anchor, -i));
  return out;
}

export function classify(perdaPct: number): "ok" | "atencao" | "critico" {
  if (perdaPct >= 25) return "critico";
  if (perdaPct >= 15) return "atencao";
  return "ok";
}

export function computeBalanco(
  injecoes: InjecaoRow[],
  faturacoes: FaturacaoRow[],
  opts: BalancoOpts,
) {
  const inj: Record<
    string,
    { kwh: number; nome: string; ilha: string; zona: string }
  > = {};
  for (const r of injecoes) {
    if (!inj[r.id_subestacao]) {
      inj[r.id_subestacao] = {
        kwh: 0,
        nome: r.subestacoes?.nome ?? "Desconhecida",
        ilha: r.subestacoes?.ilha ?? "—",
        zona: r.subestacoes?.zona_bairro ?? "—",
      };
    }
    inj[r.id_subestacao].kwh += r.total_kwh_injetado;
  }

  const fat: Record<string, number> = {};
  for (const r of faturacoes) {
    if (opts.tipoTarifa && r.clientes?.tipo_tarifa !== opts.tipoTarifa) continue;
    const subId = r.clientes?.id_subestacao ?? "";
    if (!subId) continue;
    fat[subId] = (fat[subId] ?? 0) + r.kwh_faturado;
  }

  const rows = Object.entries(inj).map(([id, info]) => {
    const inje = info.kwh;
    const fatu = fat[id] ?? 0;
    const perdaKwh = Math.max(0, inje - fatu);
    const perdaPct = inje > 0 ? (perdaKwh / inje) * 100 : 0;
    const tecCap = inje * (opts.tecnicoMaxPct / 100);
    const tecnica = Math.min(perdaKwh, tecCap);
    const comercial = Math.max(0, perdaKwh - tecnica);
    return {
      id,
      nome: info.nome,
      ilha: info.ilha,
      zona_bairro: info.zona,
      kwh_injetado: Math.round(inje),
      kwh_faturado: Math.round(fatu),
      perda_kwh: Math.round(perdaKwh),
      perda_pct: Math.round(perdaPct * 10) / 10,
      cve_estimado: Math.round(perdaKwh * opts.precoCvePorKwh),
      perda_tecnica_kwh: Math.round(tecnica),
      perda_comercial_kwh: Math.round(comercial),
      classificacao: classify(perdaPct),
    };
  });

  const filtered = opts.zona
    ? rows.filter((r) => r.zona_bairro === opts.zona)
    : rows;
  return filtered.sort((a, b) => b.perda_kwh - a.perda_kwh);
}
