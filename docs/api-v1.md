# API REST Pública v1 — Referência

API REST para integração programática com o Fiskix.  
Base URL: `https://fiskix.vercel.app/api/v1`

---

## Autenticação

Todas as rotas requerem `Authorization: Bearer <api_key>`.

As chaves são guardadas na tabela `configuracoes` com o prefixo `api_key_`
(ex: chave `api_key_electra`). Geração:

```bash
openssl rand -hex 32
# Inserir no Supabase:
# UPDATE configuracoes SET valor = '<nova_chave>' WHERE chave = 'api_key_electra';
```

Pedidos sem chave ou com chave inválida retornam **HTTP 401**.

---

## Rate Limiting

**60 pedidos/minuto por chave** (janela deslizante in-memory, resets a cada minuto).

Todas as respostas incluem:

| Header | Descrição |
|--------|-----------|
| `X-RateLimit-Remaining` | Pedidos restantes na janela actual |
| `X-RateLimit-Reset` | Unix timestamp (segundos) quando a janela reinicia |

Excedido → **HTTP 429** com `{ "error": "Rate limit excedido." }`

---

## Envelope de resposta

Todas as respostas de sucesso seguem o formato:

```json
{
  "data": <objeto ou array>,
  "meta": { "total": 123, "page": 1, "limit": 50 }
}
```

Os endpoints que devolvem item único omitem `meta`. Erros seguem:

```json
{ "error": "mensagem legível", "details": [...] }
```

---

## Cache-Control

Meses passados (anteriores ao mês corrente) retornam `Cache-Control: public, max-age=3600`.  
O mês atual retorna `Cache-Control: no-store` (dados ainda em mutação).

---

## Endpoints

### GET /api/v1/alertas

Lista paginada de alertas de fraude com dados do cliente e subestação.

#### Parâmetros de query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `mes_ano` | `YYYY-MM` | Não | Filtrar por mês |
| `status` | enum | Não | `Pendente`, `Notificado_SMS`, `Pendente_Inspecao`, `Inspecionado` |
| `min_score` | `0`–`100` | Não | Score mínimo (inclusive) |
| `subestacao_id` | UUID | Não | Filtrar por subestação |
| `limit` | `1`–`100` | Não | Resultados por página (default `50`) |
| `page` | `1`+ | Não | Número da página (default `1`) |

#### Exemplo de pedido

```bash
curl -H "Authorization: Bearer <chave>" \
  "https://fiskix.vercel.app/api/v1/alertas?mes_ano=2026-03&min_score=75&limit=10"
```

#### Resposta `200 OK`

```json
{
  "data": [
    {
      "id": "uuid-alerta",
      "score_risco": 82,
      "status": "Pendente",
      "resultado": null,
      "mes_ano": "2026-03",
      "criado_em": "2026-04-01T02:15:33Z",
      "clientes": {
        "id": "uuid-cliente",
        "numero_contador": "607023",
        "nome_titular": "MARIA ORLANDA LOPES",
        "tipo_tarifa": "BTN",
        "subestacoes": {
          "id": "uuid-sub",
          "nome": "PT Fazenda",
          "zona_bairro": "Praia_Centro"
        }
      }
    }
  ],
  "meta": {
    "total": 47,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET /api/v1/alertas/:id

Detalhe completo de um alerta: motivo (regras disparadas), dados enriquecidos do cliente e fatura do mês.

#### Parâmetros de rota

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | UUID | ID do alerta |

#### Exemplo de pedido

```bash
curl -H "Authorization: Bearer <chave>" \
  "https://fiskix.vercel.app/api/v1/alertas/uuid-alerta"
```

#### Resposta `200 OK`

```json
{
  "data": {
    "id": "uuid-alerta",
    "score_risco": 82,
    "status": "Pendente",
    "resultado": null,
    "mes_ano": "2026-03",
    "criado_em": "2026-04-01T02:15:33Z",
    "atualizado_em": "2026-04-01T02:15:33Z",
    "motivo": [
      { "regra": "R1", "pontos": 18, "descricao": "Queda de 42.3% no consumo vs. média de 6 meses", "valor": 42.3, "threshold": 30 },
      { "regra": "R3", "pontos": 20, "descricao": "Z-score = -3.80 — consumo muito abaixo da mediana", "valor": -3.8, "threshold": -2 },
      { "regra": "R7", "pontos": 5, "descricao": "2 alerta(s) confirmado(s) nos últimos 12 meses (reincidente)" },
      { "regra": "R2", "pontos": 0, "descricao": "CV = 0.0520 — variação normal" }
    ],
    "clientes": {
      "id": "uuid-cliente",
      "numero_contador": "607023",
      "nome_titular": "MARIA ORLANDA LOPES",
      "tipo_tarifa": "BTN",
      "morada": "ZONA CIDADELA 363 RC",
      "telemovel": "+238123456",
      "nif": "161087604",
      "cil": "60234421",
      "numero_conta": "60220307/001",
      "potencia_contratada_w": 6600,
      "unidade_comercial": "PRAIA",
      "subestacoes": {
        "id": "uuid-sub",
        "nome": "PT Fazenda",
        "zona_bairro": "Praia_Centro",
        "ilha": "Santiago"
      }
    },
    "fatura": {
      "kwh_faturado": 53,
      "valor_cve": 1839,
      "saldo_atual_cve": 7233,
      "tipo_leitura": "estimada",
      "leitura_inicial": 311,
      "leitura_final": 364,
      "periodo_inicio": "2026-02-21",
      "periodo_fim": "2026-03-20"
    }
  }
}
```

**Nota:** `fatura` pode ser `null` em instalações com dados anteriores à migration 021.  
O campo `motivo` lista **todas** as regras avaliadas — tanto com pontos como sem (para auditoria).

---

### GET /api/v1/balanco

Balanço energético por subestação, com split entre perdas técnicas e comerciais.

#### Parâmetros de query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `mes_ano` | `YYYY-MM` | **Sim** | Mês do balanço |
| `subestacao_id` | UUID | Não | Filtrar por subestação (omitir = todas) |

#### Exemplo de pedido

```bash
curl -H "Authorization: Bearer <chave>" \
  "https://fiskix.vercel.app/api/v1/balanco?mes_ano=2026-03"
```

#### Resposta `200 OK`

```json
{
  "data": {
    "mes_ano": "2026-03",
    "totais": {
      "kwh_injetado": 125000,
      "kwh_faturado": 98000,
      "perda_kwh": 27000,
      "perda_tecnica_kwh": 6250,
      "perda_comercial_kwh": 20750,
      "cve_perdido_estimado": 405000,
      "zonas_vermelhas": 3
    },
    "subestacoes": [
      {
        "subestacao_id": "uuid-sub",
        "nome": "PT Fazenda",
        "zona_bairro": "Praia_Centro",
        "ilha": "Santiago",
        "mes_ano": "2026-03",
        "kwh_injetado": 18400,
        "kwh_faturado": 13100,
        "perda_kwh": 5300,
        "perda_pct": 28.80,
        "perda_tecnica_kwh": 920,
        "perda_comercial_kwh": 4380,
        "zona_vermelha": true,
        "cve_perdido_estimado": 79500
      }
    ]
  }
}
```

**Cálculo das perdas:**
- `perda_tecnica_kwh = round(kwh_injetado × perda_tecnica_estimada_pct / 100)` (default 5%)
- `perda_comercial_kwh = max(0, perda_kwh − perda_tecnica_kwh)`
- `cve_perdido_estimado = perda_kwh × tarifa_média` (tarifa média da subestação; fallback 15 CVE/kWh)

O limiar `perda_tecnica_estimada_pct` é configurável em `/admin/configuracao`.

---

### GET /api/v1/predicoes

Lista paginada de predições do modelo ML heurístico.

#### Parâmetros de query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `mes_ano` | `YYYY-MM` | Não | Filtrar por mês |
| `min_score_ml` | `0.0`–`1.0` | Não | Score ML mínimo (default `0`) |
| `limit` | `1`–`100` | Não | Resultados por página (default `50`) |
| `page` | `1`+ | Não | Número da página (default `1`) |

#### Exemplo de pedido

```bash
curl -H "Authorization: Bearer <chave>" \
  "https://fiskix.vercel.app/api/v1/predicoes?mes_ano=2026-03&min_score_ml=0.7"
```

#### Resposta `200 OK`

```json
{
  "data": [
    {
      "id": "uuid-predicao",
      "score_ml": 0.87,
      "modelo_versao": "heuristic_v1",
      "features_json": {
        "pontos_r1": 18, "pontos_r2": 0, "pontos_r3": 20,
        "pontos_r4": 0, "pontos_r5": 0, "pontos_r6": 0,
        "pontos_r7": 5, "pontos_r8": 0, "reincidencia": 1
      },
      "mes_ano": "2026-03",
      "criado_em": "2026-04-02T03:10:00Z",
      "clientes": {
        "id": "uuid-cliente",
        "numero_contador": "607023",
        "nome_titular": "MARIA ORLANDA LOPES",
        "subestacoes": {
          "nome": "PT Fazenda",
          "zona_bairro": "Praia_Centro"
        }
      }
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 50
  }
}
```

**Nota:** `score_ml` está no intervalo [0, 1]. Valores ≥ 0.7 indicam alta probabilidade de fraude confirmada.  
O `modelo_versao` é `"heuristic_v1"` até existirem 100+ inspeções confirmadas para treinar `"logistic_v1"`.

---

## Códigos de erro

| Código | Significado |
|--------|-------------|
| `400` | Parâmetros inválidos (formato UUID, YYYY-MM, etc.) |
| `401` | API key ausente ou inválida |
| `404` | Recurso não encontrado |
| `429` | Rate limit excedido (60 req/min) |
| `500` | Erro interno do servidor |

---

## CORS

Todas as rotas aceitam pedidos `OPTIONS` para CORS preflight.

O header `Access-Control-Allow-Origin` é dinâmico:
- Se `configuracoes.api_v1_allowed_origins` estiver vazio → `*` (wildcard, compat B2B)
- Se a allowlist estiver preenchida → echo do `Origin` se estiver na lista; `null` caso contrário

A allowlist é gerida em `/admin/configuracao` sem necessidade de redeploy.
