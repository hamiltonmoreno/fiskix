import { describe, it, expect } from "vitest";
import { parseFaturaEdec } from "@/lib/parsers/fatura-edec";

// Texto real extraído da fatura EDEC Maria Orlanda Lopes de Barros (Mar 2026).
// Reproduz o formato canónico que o user vai colar na UI admin.
const FATURA_MARIA_ORLANDA = `
EDEC
Empresa de Distribuição de Electricidade de Cabo Verde
NIF: 298066297

FATURA 1/2

Titular do Contrato
MARIA ORLANDA LOPES DE BARROS
NIF: 161087604
Nº Cliente/Conta: 60220307/001
Código Local Consumo - CIL nº 60234421
ZONA CIDADELA 363 2º, CIDADELA, 7200 PRAIA

Data de Emissão: 2026-03-25
Data Limite Pagamento: 2026-04-24

Leituras (kWh)
Activa: 364,00 kWh
Leitura Real a 2026-03-20

Resumo de Valores
Electricidade: 1.310,00 CVE
IVA: 105,00 CVE
Audiovisual: 424,00 CVE
Outros: 0,00 CVE
Valor Total: 1839 CVE

Conta
Saldo Anterior: 5.394,00 CVE
Fatura: 1.839,00 CVE
Saldo Atual: 7.233,00 CVE

Detalhes da(s) Fatura(s)
Eletricidade
Unidade Comercial: PRAIA
Número de Fatura: 017260306038690
Tarifa: Baixa Tensão Normal (BTN)
Período Faturação: 2026-02-21 a 2026-03-20
Tipo de Cliente: Domésticos
Tipo de Leitura: Empresa

Contador Nº: 607023
Leitura Anterior: 311
Leitura Atual: 364
Potência: 6600 W
Consumo Real Medido: 53,00 kWh

Total: 1.839,00 CVE
`;

describe("parseFaturaEdec", () => {
  it("extrai os dados de identificação do cliente", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.nif).toBe("161087604");
    expect(r.cil).toBe("60234421");
    expect(r.numero_conta).toBe("60220307/001");
    expect(r.nome_titular).toBe("MARIA ORLANDA LOPES DE BARROS");
    expect(r.numero_contador).toBe("607023");
  });

  it("extrai a unidade comercial e tarifa", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.unidade_comercial).toMatch(/PRAIA/i);
    expect(r.tipo_tarifa).toBe("BTN");
  });

  it("extrai a potência contratada em watts", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.potencia_contratada_w).toBe(6600);
  });

  it("extrai o número da fatura e período de faturação", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.numero_fatura).toBe("017260306038690");
    expect(r.periodo_inicio).toBe("2026-02-21");
    expect(r.periodo_fim).toBe("2026-03-20");
    expect(r.mes_ano).toBe("2026-03");
  });

  it("extrai tipo de leitura (Empresa → 'empresa')", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.tipo_leitura).toBe("empresa");
  });

  it("extrai leituras inicial e final do contador", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.leitura_inicial).toBe(311);
    expect(r.leitura_final).toBe(364);
  });

  it("extrai consumo em kWh e valor total em CVE", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.kwh_faturado).toBe(53);
    // Aceita 1839 ou 1.839 dependendo de qual regex apanha primeiro
    expect(r.valor_cve).toBe(1839);
  });

  it("extrai saldo anterior e atual (R10 sinal)", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.saldo_anterior_cve).toBe(5394);
    expect(r.saldo_atual_cve).toBe(7233);
  });

  it("não emite warnings para uma fatura completa", () => {
    const r = parseFaturaEdec(FATURA_MARIA_ORLANDA);
    expect(r.warnings).toEqual([]);
  });

  it("emite warnings para fatura incompleta", () => {
    const incompleta = "Apenas texto solto, sem campos EDEC.";
    const r = parseFaturaEdec(incompleta);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes("numero_contador"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("kwh_faturado"))).toBe(true);
  });

  it("trata vírgula decimal portuguesa (53,00 → 53)", () => {
    const r = parseFaturaEdec("Consumo Real Medido: 53,00 kWh");
    expect(r.kwh_faturado).toBe(53);
  });

  it("trata milhares com ponto (5.394,00 → 5394)", () => {
    const r = parseFaturaEdec("Saldo Anterior: 5.394,00 CVE");
    expect(r.saldo_anterior_cve).toBe(5394);
  });

  it("retorna null em campos opcionais ausentes (não falha)", () => {
    const r = parseFaturaEdec("FATURA 1/2");
    expect(r.cil).toBeNull();
    expect(r.nome_titular).toBeNull();
    expect(r.tipo_leitura).toBeNull();
    // warnings devem estar populados
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("normaliza tipo_leitura em lowercase e ignora valores fora do enum", () => {
    const r1 = parseFaturaEdec("Tipo de Leitura: Real");
    expect(r1.tipo_leitura).toBe("real");
    const r2 = parseFaturaEdec("Tipo de Leitura: Telemetria");
    expect(r2.tipo_leitura).toBeNull();
  });
});
