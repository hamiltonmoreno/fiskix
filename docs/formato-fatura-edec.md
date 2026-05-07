# Formato Fatura EDEC — Referência Técnica

EDEC (Empresa de Distribuição de Electricidade de Cabo Verde, NIF 298066297)
emite faturas mensais aos clientes. Esta referência mapeia cada campo da
fatura impressa para o schema do Fiskix e indica como cada campo é usado
pelo motor de scoring.

## Estrutura da fatura (2 páginas)

### Página 1 — Resumo

| Secção | Campo | Exemplo | Schema Fiskix |
|--------|-------|---------|---------------|
| **Cabeçalho** | NIF EDEC | 298066297 | n/a |
| **Titular** | Nome | MARIA ORLANDA LOPES DE BARROS | `clientes.nome_titular` |
| | NIF cliente | 161087604 | `clientes.nif` (021) |
| | Nº Cliente/Conta | 60220307/001 | `clientes.numero_conta` (021) |
| | CIL | 60234421 | `clientes.cil` (021) |
| | Morada | ZONA CIDADELA 363 RC | `clientes.morada` |
| **Datas** | Emissão | 2026-03-25 | `faturacao_clientes.criado_em` (proxy) |
| | Limite pagamento | 2026-04-24 | n/a |
| **Gráfico consumo** | 12 meses kWh+CVE | barra mensal | derivado de `faturacao_clientes` |
| **Leitura actual** | kWh | 364 (real, 2026-03-20) | `faturacao_clientes.leitura_final` (021) |
| **Resumo valores** | Electricidade | 1.310 CVE | parcela de `componentes_jsonb` (021) |
| | IVA | 105 CVE | parcela |
| | Audiovisual | 424 CVE | parcela |
| | Outros | 0 CVE | parcela |
| | Valor Total | 1.839 CVE | `faturacao_clientes.valor_cve` |
| **Conta** | Saldo Anterior | 5.394 CVE | `faturacao_clientes.saldo_anterior_cve` (021) |
| | Fatura | 1.839 CVE | `faturacao_clientes.valor_cve` |
| | **Saldo Atual** | **7.233 CVE** | `faturacao_clientes.saldo_atual_cve` (021) — **R10** |
| **Talão** | Entidade Vinti4 | 136 | n/a |
| | Referência | 256 915 317 | n/a (pagamento) |

### Página 2 — Detalhes

| Secção | Campo | Exemplo | Schema Fiskix |
|--------|-------|---------|---------------|
| **Eletricidade** | Nº Fatura | 017260306038690 | `faturacao_clientes.numero_fatura` (021) |
| | Período Faturação | 2026-02-21 → 2026-03-20 | `periodo_inicio` / `periodo_fim` (021) |
| | Tarifa | Baixa Tensão Normal (BTN) | `clientes.tipo_tarifa` |
| | Tipo Cliente | Domésticos | `clientes.tipo_tarifa` (proxy) |
| | **Tipo Leitura** | **Empresa / Estimada / Cliente / Real** | `faturacao_clientes.tipo_leitura` (021) — **R11** |
| | Unidade Comercial | PRAIA | `clientes.unidade_comercial` (021) |
| **Contador** | Nº | 607023 | `clientes.numero_contador` |
| | Leituras Anteriores | 169 (2025-12-17) → 311 (2026-02-20) | histórico |
| | Leitura Atual | 364 (2026-03-20) | `leitura_final` |
| | Leitura Anterior | 311 | `leitura_inicial` |
| | **Potência** | **6600** (W = 6.6 kW) | `clientes.potencia_contratada_w` (021) — **R12** |
| | Consumo Real Medido | 53 kWh | `kwh_faturado` |
| **Decomposição** | Electricidade [0-60] | 53,00 × 22,73 = 1.205 CVE | `componentes_jsonb.electricidade` |
| | Tarifa Fixa | 105 CVE | `componentes_jsonb.tarifa_fixa` |
| | Contribuição IP | 53 × 5,49% (sem valor activo) | `componentes_jsonb.ip` |
| | IVA 8% | 1.310 × 8% = 105 CVE | `componentes_jsonb.iva` |
| | Audiovisual | 424 CVE/mês | `componentes_jsonb.audiovisual` |
| | Arredondamento | -0,29 / +0,29 | balanço a zero |

## Glossário EDEC

- **CIL** — Código Local de Consumo. Identifica fisicamente o ponto. Permanente quando o titular muda.
- **NIF** — Número Identificação Fiscal.
- **BTN** — Baixa Tensão Normal (tarifa doméstica/pequeno comércio).
- **IP** — Iluminação Pública (taxa percentual sobre kWh consumidos).
- **Audiovisual** — taxa fixa mensal para serviço público de televisão (RTC).
- **Tipo de leitura "Empresa"** — leitura presencial por colaborador EDEC (= "real" no nosso enum).
- **Tipo de leitura "Cliente"** — leitura comunicada pelo cliente.
- **Tipo de leitura "Estimada"** — calculada algoritmicamente (cliente recusou ou impediu acesso).

## Mapeamento para regras de scoring

### R10 — Dívida Acumulada (saldo_atual_cve ≥ limiar)

Cliente com saldo > 3.000 CVE tem incentivo financeiro directo para fraude
(adia pagamento, espera suspensão; alguns ligam directo à rede).

- **Fonte**: `Saldo Atual` da página 1 (ex: 7.233 CVE)
- **Pontos**: 0–10 (linear, capped)
- **Default limiar**: 3.000 CVE — configurável em `configuracoes.limiar_divida_acumulada_cve`

### R11 — Leitura Estimada Recorrente (3+ meses consecutivos)

Cliente que sistematicamente bloqueia o acesso ao contador → estimativa.
Sinal forte de manipulação (recusa de inspeção física para esconder fraude).

- **Fonte**: `Tipo Leitura` em meses consecutivos
- **Pontos**: +5 (binário)
- **Default**: 3 meses — configurável em `configuracoes.r11_meses_min_estimada`

### R12 — Subutilização de Potência Contratada

`uso_pct = kWh_mês / (potência_kW × 24h × 30d) × 100`. Se < 1%, cliente
contratou capacidade significativa mas usa muito pouco — possível by-pass
para a maior parte do consumo real.

- **Fonte**: `Potência` (em watts) + `Consumo Real Medido`
- **Caso real Maria Orlanda**: 53 kWh ÷ (6,6 × 24 × 30) = 1,12% → borderline (não dispara)
- **Pontos**: 0–5 (linear)

## Ingestão CSV — formato estendido

`ingest-data` aceita ambos os formatos:

### Mínimo (compat retroativa)
```csv
numero_contador,mes_ano,kwh_faturado,valor_cve
607023,2026-03,53,1839
```

### Estendido (recomendado para faturas EDEC novas)
```csv
numero_contador,mes_ano,kwh_faturado,valor_cve,numero_fatura,tipo_leitura,leitura_inicial,leitura_final,saldo_anterior_cve,saldo_atual_cve,periodo_inicio,periodo_fim
607023,2026-03,53,1839,017260306038690,empresa,311,364,5394,7233,2026-02-21,2026-03-20
```

Colunas opcionais que ficam vazias produzem `NULL` no schema (não erro).

## Fase 2 (planeada) — Parser PDF/Imagem automático

Edge function `parse-fatura-edec` que aceita upload de PDF/imagem,
extrai os campos via OCR + heurísticas, popula `faturacao_clientes` +
enriquece `clientes` com NIF/CIL/potência. Não implementado nesta fase.

## Fontes

- Fatura real Maria Orlanda Lopes de Barros, Mar/2026 (CIL 60234421)
- Lei nº 21/VIII/2012 de 19/Dez (suspensão por dívida ≥ 15 dias após data limite)
