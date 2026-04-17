# Design — RMSE para Modelo ML

**Data:** 2026-04-17
**Âmbito:** Avaliação de qualidade do modelo `heuristic_v1` via RMSE mensal automático
**Estado:** Aprovado

---

## Contexto

O modelo ML do Fiskix (`ml-scoring`) produz um `score_ml ∈ [0,1]` por regressão logística heurística com 7 features extraídas das regras R1–R8. Os resultados ficam em `ml_predicoes`. Os outcomes reais ficam em `relatorios_inspecao` e `alertas_fraude.resultado`.

Sem uma métrica de qualidade automática, não é possível acompanhar a evolução do modelo ao longo do tempo nem saber quando vale a pena migrar de `heuristic_v1` para `logistic_v1`.

---

## Decisões de design

| Decisão | Escolha | Razão |
|---|---|---|
| Onde calcular | Passo extra no cron `/api/cron/ml` | Zero infra nova, histórico automático |
| Ground truth | Relatório de inspecção + fallback alertas | Maximiza amostras, prioriza evidência física |
| Persistência | `configuracoes[ml_rmse_historico]` (JSON array) | Consistente com padrão existente de configurações ML |
| Lib externa | Nenhuma — cálculo puro em TypeScript | RMSE = 3 linhas, não justifica dependência |

---

## Arquitectura

```
/api/cron/ml (dia 2 de cada mês)
  ├── scoring: chama ml-scoring por subestação    ← já existe
  └── avaliação: calcularRMSE(mesAnterior, supabase)  ← novo
        ├── query ml_predicoes (mes_ano = M-1)
        ├── query relatorios_inspecao (mes_ano = M-1)
        ├── query alertas_fraude (mes_ano = M-1, resultado resolvido)
        ├── inner join predições ∩ ground truth
        ├── rmse = sqrt(mean((score_ml - y_true)²))
        └── UPSERT configuracoes[ml_rmse_historico]
```

---

## Ficheiros

| Ficheiro | Acção |
|---|---|
| `src/lib/ml/rmse.ts` | Novo — função pura `calcularRMSE` + tipos |
| `src/app/api/cron/ml/route.ts` | Modificar — adicionar chamada pós-scoring |
| `src/__tests__/ml-rmse.test.ts` | Novo — testes unitários à função pura |
| `src/__tests__/cron-ml.test.ts` | Modificar — novos casos de integração |

---

## Fluxo de dados

### 1. Buscar predições

```sql
SELECT id_cliente, score_ml
FROM ml_predicoes
WHERE mes_ano = :mes_ano
  AND modelo_versao = 'heuristic_v1'
```

### 2. Buscar ground truth (prioridade: relatório > alerta)

**Relatórios de inspecção** (prioridade 1 — JOIN via `id_alerta`):
```sql
SELECT af.id_cliente, ri.resultado
FROM relatorios_inspecao ri
JOIN alertas_fraude af ON af.id = ri.id_alerta
WHERE af.mes_ano = :mes_ano
```

**Alertas resolvidos** (fallback):
```sql
SELECT id_cliente, resultado
FROM alertas_fraude
WHERE mes_ano = :mes_ano
  AND resultado NOT IN ('Pendente', 'Pendente_Inspecao')
```

### 3. Mapeamento de labels

| `resultado` | `y_true` |
|---|---|
| `Fraude_Confirmada` | `1` |
| `Anomalia_Tecnica` | `1` |
| `Sem_Anomalia` | `0` |
| `Falso_Positivo` | `0` |

### 4. Cálculo

```typescript
const errors = pares.map(({ score_ml, y_true }) => (score_ml - y_true) ** 2);
const rmse = Math.sqrt(errors.reduce((a, b) => a + b, 0) / errors.length);
```

### 5. Guarda em `configuracoes`

Chave: `ml_rmse_historico`
Valor (JSON array, appended por mês):
```json
[
  { "mes_ano": "2026-03", "rmse": 0.312, "n_amostras": 47 },
  { "mes_ano": "2026-04", "rmse": 0.289, "n_amostras": 53 }
]
```

---

## Casos limite

| Condição | Comportamento |
|---|---|
| `n_amostras < 5` | `rmse: null`, `nota: "amostras_insuficientes"` |
| 0 predições para o mês | `rmse: null`, `n_amostras: 0` |
| Erro na query Supabase | Cron retorna 200 com campo `rmse_error`; scoring não é afectado |
| Mês sem relatórios (só alertas) | Usa fallback alertas normalmente |

---

## Testes

### Unitários — `src/__tests__/ml-rmse.test.ts`

| Cenário | Expectativa |
|---|---|
| Array vazio | `{ rmse: null, n_amostras: 0 }` |
| < 5 amostras | `{ rmse: null, nota: "amostras_insuficientes" }` |
| Todos correctos (score=1, y=1) | `rmse ≈ 0` |
| Todos errados (score=1, y=0) | `rmse = 1` |
| Mix realista | valor correcto validado manualmente |
| Relatório tem prioridade sobre alerta | usa label do relatório |

### Integração — `src/__tests__/cron-ml.test.ts` (novos casos)

| Cenário | Expectativa |
|---|---|
| Cron inclui `rmse` na resposta | campo presente |
| Erro no cálculo RMSE | cron retorna 200, `rmse_error` presente |
| RMSE guardado em `configuracoes` | upsert chamado com chave correcta |

---

## Fora de âmbito

- Widget de UI em `/admin/scoring` (iteração futura)
- Métricas adicionais: precision, recall, AUC (iteração futura)
- Migração automática `heuristic_v1` → `logistic_v1` baseada em RMSE
