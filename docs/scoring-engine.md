# Motor de Scoring — Referência Técnica

Motor de deteção de fraude do Fiskix, aplicado mensalmente a cada cliente
das subestações em zona vermelha. Implementado em dois ficheiros espelhados
para garantir paridade entre o ambiente Next.js e o Deno edge:

| Ficheiro | Ambiente | Usado por |
|----------|----------|-----------|
| `src/modules/scoring/rules/engine.ts` | Next.js / Vitest | UI de scoring manual, testes |
| `supabase/functions/scoring-engine/pure.ts` | Deno Edge | Cron automático, execução via API |

Os dois ficheiros são mantidos em paridade estrita pelo teste
`src/__tests__/scoring-parity.test.ts`, que falha se os scores divergirem.

As **constantes** têm fonte única em `src/modules/scoring/constants.ts`,
espelhadas para `supabase/functions/_shared/scoring-constants.ts`.

---

## Arquitetura de dois estágios

```
Faturação CSV → ingest-data → faturacao_clientes
Injeção CSV  → ingest-data → injecao_energia
                                  │
                         ┌────────▼────────┐
                         │  ETAPA A        │
                         │  Balanço        │  perda_pct > 15% ?
                         │  Energético     │──────────────────────► Zona Verde → sem scoring
                         └────────┬────────┘
                                  │ Zona Vermelha
                         ┌────────▼────────┐
                         │  ETAPA B        │
                         │  12 Regras      │  score_final ≥ 50 ?
                         │  por cliente    │──────────────────────► INSERT/UPDATE alertas_fraude
                         └─────────────────┘
```

---

## Etapa A — Balanço Energético (R9 — Filtro Macro)

Calculado uma vez por subestação antes de qualquer scoring individual.

```
perda_pct = (kwh_injetado - kwh_faturado_total) / kwh_injetado × 100

zona_vermelha = perda_pct > LIMIAR_PERDA_ZONA_PCT   (default: 15%)

multiplicador_zona =
  se zona_vermelha:
    R9_MULT_BASE + min(R9_MULT_MAX_DELTA, (perda_pct/100 − LIMIAR/100) × R9_MULT_FACTOR)
    = 1.0 + min(0.3, (perda_pct/100 − 0.15) × 2)
    → range: 1.00 – 1.30
  senão:
    1.00  (sem scoring individual necessário)
```

**Exemplo:** subestação com 25% de perda →
`multiplicador = 1.0 + min(0.3, (0.25 − 0.15) × 2) = 1.0 + 0.2 = 1.20`

---

## Etapa B — 12 Regras Graduais (Filtro Micro)

O **score_base** é a soma dos pontos de todas as regras.  
O **score_final** aplica o multiplicador de zona e é limitado a 100.

```
score_base  = Σ pontos(R1..R12)
score_final = min(100, round(score_base × multiplicador_zona))

alerta gerado se score_final ≥ 50  (SCORE_LIMIAR_ALERTA)
  CRÍTICO  → score_final ≥ 75
  MÉDIO    → 50 ≤ score_final < 75
```

---

### R1 — Queda Súbita Graduada (0–25 pts)

**Deteta:** Queda abrupta no consumo vs. média histórica adaptativa.

```
janela  = min(idx, R1_WINDOW_MAX)       # 3–6 meses antes do mês atual
μ       = média(kwh nos últimos janela meses)
δ       = (μ − C_atual) / μ × 100      # queda percentual

se δ < LIMIAR_QUEDA_PCT  → 0 pts
senão: pts = min(R1_PONTOS_MAX, floor((δ − LIMIAR_QUEDA_PCT) × R1_FACTOR))
           = min(25, floor((δ − 30) × 0.625))
```

**Requisitos:** ≥ 3 meses de histórico (`R1_MIN_INDEX = 3`)  
**Configurável:** `limiar_queda_pct` (default 30%)

---

### R2 — Variância Zero Contextualizada (0–15 pts)

**Deteta:** Consumo anormalmente constante nos últimos 4 meses — sinal de contador travado.

```
janela  = últimos R2_WINDOW meses incluindo atual  (R2_WINDOW = 4)
μ       = média(janela)
se μ ≤ LIMIAR_MU_MINIMO  → 0 pts  (possível casa vazia)

CV = σ / μ
se CV ≥ LIMIAR_CV_MAXIMO  → 0 pts  (variação normal)
senão: pts = min(R2_PONTOS_MAX, round((1 − CV / LIMIAR_CV_MAXIMO) × R2_PONTOS_MAX))
           = min(15, round((1 − CV / 0.03) × 15))
```

**Requisitos:** `idx ≥ R2_WINDOW − 1` (= 3), `μ > 15 kWh`  
**Configurável:** `limiar_cv_maximo` (default 0.03), `limiar_mu_minimo` (default 15)

---

### R3 — Desvio de Cluster Segmentado (0–20 pts)

**Deteta:** Consumo muito abaixo da mediana dos clientes da mesma tarifa na subestação.

```
Z = (C_atual − mediana_cluster) / MAD_cluster

se MAD = 0  → 0 pts (sem variação no cluster)
se Z ≥ LIMIAR_ZSCORE_CLUSTER  → 0 pts
senão: pts = min(R3_PONTOS_MAX, round(|Z − LIMIAR_ZSCORE_CLUSTER| × R3_FACTOR))
           = min(20, round(|Z − (−2)| × 5))
```

**Cluster:** todos os clientes com a mesma `tipo_tarifa` na subestação, segmentados por mês.  
**Configurável:** `limiar_zscore_cluster` (default −2)

---

### R4 — Divergência Sazonal Reforçada (0–15 pts)

**Deteta:** A subestação subiu mas o cliente desceu — padrão típico de by-pass sazonal.

```
Δ_sub = tendência mês-a-mês da subestação (% variação injeção)
Δ_cli = (C_atual − C_anterior) / C_anterior × 100
div   = Δ_sub − Δ_cli

se div ≤ LIMIAR_DIV_SAZONAL  → 0 pts
senão: pts = min(R4_PONTOS_MAX, round((div − LIMIAR_DIV_SAZONAL) × R4_FACTOR))
           = min(15, round((div − 20) × 0.5))
```

**Requisitos:** `idx ≥ 2`, `C_anterior > 0`  
**Configurável:** `limiar_div_sazonal` (default 20%)

---

### R5 — Tendência Descendente Persistente (0–10 pts)

**Deteta:** Queda gradual e constante (slow bleed) — contador adulterado há vários meses.

```
janela  = últimos R5_WINDOW meses incluindo atual  (R5_WINDOW = 6)
xs      = [0, 1, 2, 3, 4, 5]
ys      = kwh_faturado da janela

# Regressão linear mínimos quadrados:
slope = (n·ΣxᵢYᵢ − Σxᵢ·ΣYᵢ) / (n·Σxᵢ² − (Σxᵢ)²)

meses_consecutivos = nº de meses contíguos com queda (contando do mais recente)

se denom = 0  → 0 pts (janela insuficiente)
se slope ≥ LIMIAR_SLOPE_TENDENCIA  → 0 pts
se meses_consecutivos < R5_MIN_MESES_CONSECUTIVOS  → 0 pts
senão: pts = min(R5_PONTOS_MAX, round(|slope − LIMIAR_SLOPE_TENDENCIA| × R5_FACTOR))
           = min(10, round(|slope − (−5)| × 0.8))
```

**Requisitos:** `idx ≥ R5_WINDOW − 1` (= 5)  
**Configurável:** `limiar_slope_tendencia` (default −5 kWh/mês)

---

### R6 — Rácio CVE/kWh Anómalo (0–5 pts)

**Deteta:** Custo unitário anormal — possível sub-faturação ou tarifa errada.

```
rácio  = valor_cve_atual / kwh_faturado_atual
desvio = |rácio − média_rácio_tarifa| / σ_rácio_tarifa

se kwh = 0 ou σ = 0 ou clusterSize < R6_MIN_CLUSTER_SIZE  → 0 pts
se desvio ≤ LIMIAR_RATIO_RACIO  → 0 pts
senão: pts = min(R6_PONTOS_MAX, round((desvio − LIMIAR_RATIO_RACIO) × R6_FACTOR))
           = min(5, round((desvio − 2) × 2))
```

**Requisitos:** cluster com ≥ 3 clientes da mesma tarifa (`R6_MIN_CLUSTER_SIZE`)  
**Configurável:** `limiar_ratio_racio` (default 2 σ)

---

### R7 — Reincidência Histórica (+5 pts bónus)

**Deteta:** Cliente com histórico de alertas confirmados — reincidência é preditor forte de fraude activa.

```
alertas_confirmados = count(alertas_fraude onde resultado IN ('Fraude_Confirmada','Anomalia_Tecnica')
                            AND mes_ano ≥ mes_12_atras AND mes_ano < mes_atual)

se alertas_confirmados = 0  → 0 pts
senão: pts = R7_BONUS = 5
```

**Lookback:** 12 meses (`R7_LOOKBACK_MESES`)  
**Nota:** Falso_Positivo não conta — só resultados que confirmam problema real.

---

### R8 — Rácio Pico Histórico vs Atual (0–5 pts)

**Deteta:** Fraudes estabilizadas onde o cliente fixou o consumo muito abaixo do seu pico.

```
historico = últimos min(idx, R8_LOOKBACK_MAX) meses  (bound a 24 meses)
pico = max(kwh_faturado nos meses históricos)
ratio = C_atual / pico

se ratio ≥ LIMIAR_PICO_RATIO  → 0 pts
senão: pts = min(R8_PONTOS_MAX, round((LIMIAR_PICO_RATIO − ratio) × R8_FACTOR))
           = min(5, round((0.20 − ratio) × 20))
```

**Requisitos:** `idx ≥ R8_MIN_INDEX` (= 6 meses)  
**Configurável:** `limiar_pico_ratio` (default 0.20 = 20%)

---

### R10 — Dívida Acumulada (0–10 pts) *(Fase 2)*

**Deteta:** Cliente com saldo em dívida elevado tem incentivo financeiro directo para manter a fraude.

```
saldo = saldo_atual_cve  (extraído da fatura EDEC — campo opcional)

se saldo = null  → 0 pts (compat retroativa)
se saldo < LIMIAR_DIVIDA_CVE  → 0 pts
senão: pts = min(R10_PONTOS_MAX, round((saldo − LIMIAR_DIVIDA_CVE) × R10_FACTOR))
           = min(10, round((saldo − 3000) × 0.001))
```

**Fonte de dados:** `faturacao_clientes.saldo_atual_cve` (migration 021, campo EDEC)  
**Configurável:** `limiar_divida_acumulada_cve` (default 3000 CVE)  
**Ver também:** [docs/formato-fatura-edec.md](./formato-fatura-edec.md)

---

### R11 — Leitura Estimada Recorrente (0 ou +5 pts) *(Fase 2)*

**Deteta:** Cliente que sistematicamente bloqueia o acesso ao contador — padrão de recusa de inspeção.

```
tipos = tipo_leitura dos últimos 6 meses (mais recente primeiro)

consecutivos = nº de 'estimada' contíguos a partir do mais recente

se tipos insuficientes  → 0 pts
se consecutivos ≥ R11_MESES_MIN_ESTIMADA  → pts = R11_PONTOS = 5
senão  → 0 pts
```

**Fonte de dados:** `faturacao_clientes.tipo_leitura` (migration 021, campo EDEC)  
**Configurável:** `r11_meses_min_estimada` (default 3 meses)

---

### R12 — Subutilização de Potência Contratada (0–5 pts) *(Fase 2)*

**Deteta:** Cliente com potência significativa contratada mas consumo muito baixo — possível by-pass do contador para a maior parte do consumo real.

```
potencia_kw      = potencia_contratada_w / 1000
capacidade_mensal = potencia_kw × 24h × 30d        (kWh teóricos por mês)
uso_pct          = (kwh_atual / capacidade_mensal) × 100

se potencia = null ou ≤ 0  → 0 pts (compat retroativa)
se uso_pct ≥ R12_THRESHOLD_PCT  → 0 pts
senão: pts = min(R12_PONTOS_MAX, round((R12_THRESHOLD_PCT − uso_pct) × R12_FACTOR))
           = min(5, round((1 − uso_pct) × 5))
```

**Fonte de dados:** `clientes.potencia_contratada_w` (migration 021, campo EDEC)  
**Configurável:** `r12_threshold_pct` (default 1%)  
**Ver também:** [docs/formato-fatura-edec.md](./formato-fatura-edec.md)

---

## Tabela de Constantes

Todas configuráveis em `/admin/configuracao` → tabela `configuracoes`.  
Valores por omissão definidos em `src/modules/scoring/constants.ts`.

| Constante | Default | Descrição |
|-----------|---------|-----------|
| `LIMIAR_QUEDA_PCT` | 30 | R1: queda mínima % para disparar |
| `LIMIAR_CV_MAXIMO` | 0.03 | R2: coeficiente de variação máximo "normal" |
| `LIMIAR_MU_MINIMO` | 15 | R2: consumo médio mínimo (kWh) para R2 se aplicar |
| `LIMIAR_ZSCORE_CLUSTER` | -2 | R3: Z-score abaixo do qual pontua |
| `LIMIAR_DIV_SAZONAL` | 20 | R4: divergência sazonal mínima % |
| `LIMIAR_SLOPE_TENDENCIA` | -5 | R5: declive negativo mínimo (kWh/mês) |
| `LIMIAR_RATIO_RACIO` | 2 | R6: desvios-padrão acima da média para anomalia |
| `LIMIAR_PICO_RATIO` | 0.20 | R8: rácio atual/pico abaixo do qual pontua |
| `LIMIAR_PERDA_ZONA_PCT` | 15 | R9/Balanço: % perda para zona vermelha |
| `LIMIAR_DIVIDA_CVE` | 3000 | R10: saldo mínimo (CVE) para pontuar |
| `R11_MESES_MIN_ESTIMADA` | 3 | R11: meses consecutivos estimados para disparar |
| `R12_THRESHOLD_PCT` | 1 | R12: uso < X% da capacidade contratada |
| `SCORE_CRITICO` | 75 | Score mínimo para classificação CRÍTICO |
| `SCORE_MEDIO` | 50 | Score mínimo para classificação MÉDIO (= SCORE_LIMIAR_ALERTA) |

---

## Persistência de alertas

O scoring nunca sobrescreve alertas que já foram actuados:

```
Novo cliente com score ≥ 50  → INSERT (status = "Pendente")
Alerta existente Pendente     → UPDATE score_risco + motivo
Alerta Notificado_SMS         → NÃO toca (SMS já enviado)
Alerta Pendente_Inspecao      → NÃO toca (ordem já emitida)
Alerta Inspecionado           → NÃO toca (inspeção realizada)
```

---

## Ciclo de vida e cron

O scoring automático corre no **dia 1 de cada mês às 02:00 UTC** via
`GET /api/cron/scoring` (Vercel Cron). Processa todas as subestações ativas
com `runPool` (concorrência ≤ 5).

Para execução manual: `/admin/scoring` na UI, ou POST direto à edge function
`scoring-engine` com service role key.
