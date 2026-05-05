/**
 * Parser textual de faturas EDEC (Electra Cabo Verde).
 *
 * Lê o texto integral de uma fatura EDEC (de OCR client-side, copy-paste,
 * ou PDF text extraction) e devolve os campos canónicos que mapeiam para
 * `clientes` + `faturacao_clientes` (formato pós-021).
 *
 * Estratégia: regex tolerante a whitespace e a variações de capitalização.
 * Cada campo tem fallbacks múltiplos — quando a fatura tem layout ligeiramente
 * diferente, o parser ainda extrai o que conseguir e devolve null nos restantes.
 *
 * Formato canónico de output (mesmas chaves que `faturacao_clientes` +
 * `clientes` para upsert directo).
 */

export interface ParsedFatura {
  // Cliente
  nif: string | null;
  cil: string | null;
  numero_conta: string | null;
  numero_contador: string | null;
  nome_titular: string | null;
  morada: string | null;
  unidade_comercial: string | null;
  potencia_contratada_w: number | null;
  tipo_tarifa: string | null;

  // Fatura
  numero_fatura: string | null;
  mes_ano: string | null;            // "YYYY-MM" derivado da data de emissão
  periodo_inicio: string | null;     // "YYYY-MM-DD"
  periodo_fim: string | null;
  tipo_leitura: "real" | "estimada" | "empresa" | "cliente" | null;
  leitura_inicial: number | null;
  leitura_final: number | null;
  kwh_faturado: number | null;
  valor_cve: number | null;
  saldo_anterior_cve: number | null;
  saldo_atual_cve: number | null;

  /** Campos não reconhecidos vão para aqui — útil para debugging. */
  warnings: string[];
}

const NUM_BR = /[0-9]+(?:[\.,][0-9]+)*/;

function pickNumber(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  const raw = m[1] ?? m[0];
  // 1.205,00 → 1205.00 ; 1,12 → 1.12 ; 6600.00 → 6600
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
  // Aceita "2026-03-25" ou "25/03/2026" ou "25-03-2026"
  const raw = m[1] ?? "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const dmy = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

export function parseFaturaEdec(text: string): ParsedFatura {
  const warnings: string[] = [];
  // Normaliza whitespace para regex tolerante mas não destrói linhas (algumas
  // ancoragens dependem do início de linha).
  const T = text.replace(/[ \t]+/g, " ").replace(/\r\n?/g, "\n");

  // ── Cliente ────────────────────────────────────────────────────────────────

  // NIF do cliente: vem DEPOIS de "Titular do Contrato". O NIF que aparece no
  // topo (NIF: 298066297) é da EDEC e não nos interessa.
  const titularSection = T.match(/Titular\s+do\s+Contrato([\s\S]*?)(?:Data\s+de\s+Emiss|Detalhes|$)/i);
  const titularBlock = titularSection?.[1] ?? T;

  const nif = pickString(/NIF[:\s]+(\d{6,12})/i, titularBlock);
  const cil = pickString(/CIL[\s\S]{0,40}?(\d{6,12})/i, T);
  const numero_conta = pickString(
    /N[ºo°]\s*Cliente\s*\/?\s*Conta[:\s]+(\d{4,12}\s*\/?\s*\d{0,4})/i,
    T,
  )?.replace(/\s/g, "") ?? null;

  // Nome titular: "Titular do Contrato" seguido por linha (única) em maiúsculas.
  // Restringimos a [^\n] em vez de \s para não atravessar linhas.
  const titularMatch = T.match(
    /Titular\s+do\s+Contrato[ \t]*\n[ \t]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])\s*$/m,
  );
  const nome_titular = titularMatch?.[1]?.trim() ?? null;

  // Morada (Zona Cidadela 363 …): aparece logo a seguir a "Morada" ou
  // "Código Local Consumo". Usa o "ZONA …" como fallback heurístico.
  const morada = pickString(/((?:ZONA|RUA|AVENIDA|R\.|AV\.)[^\n,]{5,80}(?:,\s*\d{4}\s+[A-ZÁÉÍÓÚÇ]+)?)/i, T);

  const unidade_comercial = pickString(/Unidade\s+Comercial[:\s]+([A-ZÁÉÍÓÚÇ\s]+)/i, T);

  const potencia_contratada_w = pickNumber(
    /Pot[êe]ncia[\s\S]{0,40}?(\d{3,5}(?:[.,]\d+)?)\s*(?:W|kW)?/i,
    T,
  );

  // Tarifa: "Baixa Tensão Normal (BTN)" → "BTN"
  const tarifaMatch = T.match(/Tarifa[:\s]+([A-Za-záéíóúâêôãõç ]+\(([A-Z]{2,5})\)|[A-Za-záéíóúâêôãõç ]+)/i);
  const tipo_tarifa = tarifaMatch?.[2] ?? tarifaMatch?.[1]?.trim() ?? null;

  // ── Fatura ─────────────────────────────────────────────────────────────────

  const numero_fatura = pickString(/N[úu]mero\s+de\s+Fatura[:\s]+(\d{8,20})/i, T)
    ?? pickString(/Documento[:\s]+(\d{10,20})/i, T);

  const data_emissao_iso = pickDate(/Data\s+de\s+Emiss[ãa]o[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/i, T);
  const mes_ano = data_emissao_iso?.slice(0, 7) ?? null;

  // Período faturação: "Período Faturação: 2026-02-21 a 2026-03-20"
  const periodoMatch = T.match(
    /Per[íi]odo\s+Fatura[çc][ãa]o[:\s]+(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})/i,
  );
  const periodo_inicio = periodoMatch?.[1] ?? null;
  const periodo_fim = periodoMatch?.[2] ?? null;

  // Tipo de leitura: "Empresa" / "Estimada" / "Cliente" / "Real"
  const tipoLeituraRaw = pickString(/Tipo\s+de\s+Leitura[:\s]+(\w+)/i, T)?.toLowerCase() ?? null;
  const tipo_leitura: ParsedFatura["tipo_leitura"] =
    tipoLeituraRaw && ["real", "estimada", "empresa", "cliente"].includes(tipoLeituraRaw)
      ? (tipoLeituraRaw as ParsedFatura["tipo_leitura"])
      : null;

  // Leituras: na fatura aparecem como sequência "169 311 64,55 311 364"
  // (anteriores → atual). Procurar "Leitura Atual" e "Leitura Ant.":
  const leitura_final = pickNumber(/Leitura\s+(?:Atual|Final)[\s\S]{0,80}?(\d{2,8})/i, T);
  const leitura_inicial = pickNumber(/Leitura\s+Ant(?:erior|\.)?[\s\S]{0,80}?(\d{2,8})/i, T);

  // Consumo "Consumo Real Medido: 53,00 kWh" ou "53 kWh"
  const kwh_faturado = pickNumber(/Consumo\s+(?:Real\s+)?Medido[\s\S]{0,40}?(\d+(?:[.,]\d+)?)\s*kWh/i, T)
    ?? pickNumber(/(\d+(?:[.,]\d+)?)\s*kWh\b/i, T);

  // Valor total: "1839 CVE" / "Total: 1.839,00 CVE"
  const valor_cve = pickNumber(/Total[:\s]+(\d+(?:[.,]\d+)*)\s*CVE/i, T)
    ?? pickNumber(/Valor\s+Total[\s\S]{0,40}?(\d+(?:[.,]\d+)*)/i, T);

  // Saldos
  const saldo_anterior_cve = pickNumber(/Saldo\s+Anterior[\s\S]{0,80}?(\d+(?:[.,]\d+)*)/i, T);
  const saldo_atual_cve = pickNumber(/Saldo\s+Atual[\s\S]{0,80}?(\d+(?:[.,]\d+)*)/i, T);

  // ── Numero de contador ─────────────────────────────────────────────────────
  // "Contador Nº: 607023"
  const numero_contador = pickString(/Contador\s+N[ºo°][:\s]+(\d{4,10})/i, T);

  // ── Warnings ───────────────────────────────────────────────────────────────
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
    nif,
    cil,
    numero_conta,
    numero_contador,
    nome_titular,
    morada,
    unidade_comercial,
    potencia_contratada_w,
    tipo_tarifa,
    numero_fatura,
    mes_ano,
    periodo_inicio,
    periodo_fim,
    tipo_leitura,
    leitura_inicial,
    leitura_final,
    kwh_faturado,
    valor_cve,
    saldo_anterior_cve,
    saldo_atual_cve,
    warnings,
  };
}
