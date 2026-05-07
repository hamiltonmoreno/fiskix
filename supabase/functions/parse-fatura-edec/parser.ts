/**
 * Mirror Deno do parser canónico em `src/lib/parsers/fatura-edec.ts`.
 *
 * Mantemos as duas cópias em sincronia manualmente (sem teste de paridade
 * por enquanto — adicionar caso surja drift). O parser é puro e sem deps,
 * por isso o overhead de duplicação é mínimo.
 */

export interface ParsedFatura {
  nif: string | null;
  cil: string | null;
  numero_conta: string | null;
  numero_contador: string | null;
  nome_titular: string | null;
  morada: string | null;
  unidade_comercial: string | null;
  potencia_contratada_w: number | null;
  tipo_tarifa: string | null;
  numero_fatura: string | null;
  mes_ano: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  tipo_leitura: "real" | "estimada" | "empresa" | "cliente" | null;
  leitura_inicial: number | null;
  leitura_final: number | null;
  kwh_faturado: number | null;
  valor_cve: number | null;
  saldo_anterior_cve: number | null;
  saldo_atual_cve: number | null;
  warnings: string[];
}

function pickNumber(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  const raw = m[1] ?? m[0];
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pickString(re: RegExp, text: string): string | null {
  const m = text.match(re);
  if (!m) return null;
  return (m[1] ?? "").trim() || null;
}

function pickDate(re: RegExp, text: string): string | null {
  const m = text.match(re);
  if (!m) return null;
  const raw = m[1] ?? "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const dmy = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

export function parseFaturaEdec(text: string): ParsedFatura {
  const warnings: string[] = [];
  const T = text.replace(/[ \t]+/g, " ").replace(/\r\n?/g, "\n");

  const titularSection = T.match(/Titular\s+do\s+Contrato([\s\S]*?)(?:Data\s+de\s+Emiss|Detalhes|$)/i);
  const titularBlock = titularSection?.[1] ?? T;

  const nif = pickString(/NIF[:\s]+(\d{6,12})/i, titularBlock);
  const cil = pickString(/CIL[\s\S]{0,40}?(\d{6,12})/i, T);
  const numero_conta = pickString(
    /N[ºo°]\s*Cliente\s*\/?\s*Conta[:\s]+(\d{4,12}\s*\/?\s*\d{0,4})/i,
    T,
  )?.replace(/\s/g, "") ?? null;

  const titularMatch = T.match(
    /Titular\s+do\s+Contrato[ \t]*\n[ \t]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])\s*$/m,
  );
  const nome_titular = titularMatch?.[1]?.trim() ?? null;

  const morada = pickString(/((?:ZONA|RUA|AVENIDA|R\.|AV\.)[^\n,]{5,80}(?:,\s*\d{4}\s+[A-ZÁÉÍÓÚÇ]+)?)/i, T);
  const unidade_comercial = pickString(/Unidade\s+Comercial[:\s]+([A-ZÁÉÍÓÚÇ\s]+)/i, T);

  const potencia_contratada_w = pickNumber(
    /Pot[êe]ncia[\s\S]{0,40}?(\d{3,5}(?:[.,]\d+)?)\s*(?:W|kW)?/i,
    T,
  );

  const tarifaMatch = T.match(/Tarifa[:\s]+([A-Za-záéíóúâêôãõç ]+\(([A-Z]{2,5})\)|[A-Za-záéíóúâêôãõç ]+)/i);
  const tipo_tarifa = tarifaMatch?.[2] ?? tarifaMatch?.[1]?.trim() ?? null;

  const numero_fatura = pickString(/N[úu]mero\s+de\s+Fatura[:\s]+(\d{8,20})/i, T)
    ?? pickString(/Documento[:\s]+(\d{10,20})/i, T);

  const data_emissao_iso = pickDate(/Data\s+de\s+Emiss[ãa]o[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/i, T);
  const mes_ano = data_emissao_iso?.slice(0, 7) ?? null;

  const periodoMatch = T.match(
    /Per[íi]odo\s+Fatura[çc][ãa]o[:\s]+(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})/i,
  );
  const periodo_inicio = periodoMatch?.[1] ?? null;
  const periodo_fim = periodoMatch?.[2] ?? null;

  const tipoLeituraRaw = pickString(/Tipo\s+de\s+Leitura[:\s]+(\w+)/i, T)?.toLowerCase() ?? null;
  const tipo_leitura: ParsedFatura["tipo_leitura"] =
    tipoLeituraRaw && ["real", "estimada", "empresa", "cliente"].includes(tipoLeituraRaw)
      ? (tipoLeituraRaw as ParsedFatura["tipo_leitura"])
      : null;

  const leitura_final = pickNumber(/Leitura\s+(?:Atual|Final)[\s\S]{0,80}?(\d{2,8})/i, T);
  const leitura_inicial = pickNumber(/Leitura\s+Ant(?:erior|\.)?[\s\S]{0,80}?(\d{2,8})/i, T);

  const kwh_faturado = pickNumber(/Consumo\s+(?:Real\s+)?Medido[\s\S]{0,40}?(\d+(?:[.,]\d+)?)\s*kWh/i, T)
    ?? pickNumber(/(\d+(?:[.,]\d+)?)\s*kWh\b/i, T);

  const valor_cve = pickNumber(/Total[:\s]+(\d+(?:[.,]\d+)*)\s*CVE/i, T)
    ?? pickNumber(/Valor\s+Total[\s\S]{0,40}?(\d+(?:[.,]\d+)*)/i, T);

  const saldo_anterior_cve = pickNumber(/Saldo\s+Anterior[\s\S]{0,80}?(\d+(?:[.,]\d+)*)/i, T);
  const saldo_atual_cve = pickNumber(/Saldo\s+Atual[\s\S]{0,80}?(\d+(?:[.,]\d+)*)/i, T);
  const numero_contador = pickString(/Contador\s+N[ºo°][:\s]+(\d{4,10})/i, T);

  const requiredButMissing = (name: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      warnings.push(`${name} não encontrado no texto`);
    }
  };
  requiredButMissing("numero_contador", numero_contador);
  requiredButMissing("kwh_faturado", kwh_faturado);
  requiredButMissing("valor_cve", valor_cve);
  requiredButMissing("mes_ano", mes_ano);

  return {
    nif, cil, numero_conta, numero_contador, nome_titular, morada,
    unidade_comercial, potencia_contratada_w, tipo_tarifa,
    numero_fatura, mes_ano, periodo_inicio, periodo_fim, tipo_leitura,
    leitura_inicial, leitura_final, kwh_faturado, valor_cve,
    saldo_anterior_cve, saldo_atual_cve, warnings,
  };
}
