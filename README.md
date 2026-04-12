# Fiskix — Fiscalização Inteligente de Energia

Plataforma SaaS de deteção de fraudes e perdas comerciais de energia elétrica.  
Cliente inicial: **Electra (Cabo Verde)** — Fases 1 e 2 completas.

**Produção:** [fiskix.vercel.app](https://fiskix.vercel.app)

---

## Índice

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Base de Dados](#base-de-dados)
- [Motor de Scoring](#motor-de-scoring)
- [Score ML (Fase 2)](#score-ml-fase-2)
- [Módulos](#módulos)
- [API REST Pública](#api-rest-pública)
- [Setup Local](#setup-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Deploy](#deploy)
- [Edge Functions](#edge-functions)
- [Roles e Permissões](#roles-e-permissões)
- [PWA Mobile](#pwa-mobile)
- [Qualidade e Testes](#qualidade-e-testes)
- [Testes E2E (Playwright)](#testes-e2e-playwright)
- [Observabilidade](#observabilidade)
- [Cron Automático](#cron-automático)
- [Roadmap](#roadmap)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Estilos | TailwindCSS |
| Gráficos | Recharts |
| Mapas | React Leaflet |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Edge Functions | Deno (Supabase Functions) |
| Deploy | Vercel (frontend) + Supabase (functions) |
| SMS | Twilio (sender "Electra" + fallback numérico) |
| Mobile | PWA (Android Chrome) — rotas `/mobile` |
| Testes | Vitest (unit/integration) + Playwright (E2E) |

---

## Arquitetura

```
fiskix/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Redirect → /dashboard
│   │   ├── login/                   # Autenticação
│   │   ├── dashboard/               # Control Room
│   │   ├── alertas/                 # Gestão de alertas
│   │   ├── relatorios/              # Relatórios multi-tab
│   │   ├── mobile/                  # PWA fiscal
│   │   │   ├── page.tsx             # Roteiro do dia
│   │   │   ├── [id]/page.tsx        # Ficha de inteligência
│   │   │   └── [id]/report/         # Relatório de inspeção
│   │   ├── admin/                   # Painel de administração
│   │   │   ├── scoring/             # Motor de scoring (manual)
│   │   │   ├── importar/            # Import CSV/Excel
│   │   │   ├── utilizadores/        # CRUD utilizadores
│   │   │   ├── configuracao/        # Limiares do motor
│   │   │   └── api-keys/            # Gestão de chaves API REST
│   │   └── api/
│   │       ├── cron/scoring/        # Cron scoring mensal (dia 1, 02:00 UTC)
│   │       ├── cron/ml/             # Cron ML mensal (dia 2, 03:00 UTC)
│   │       └── v1/                  # API REST pública
│   │           ├── alertas/         # GET /api/v1/alertas
│   │           ├── alertas/[id]/    # GET /api/v1/alertas/:id
│   │           ├── balanco/         # GET /api/v1/balanco
│   │           └── predicoes/       # GET /api/v1/predicoes
│   ├── __tests__/                   # Suite de testes (31 ficheiros, 300 testes)
│   ├── components/
│   │   ├── Sidebar.tsx              # Navegação lateral responsiva
│   │   └── Breadcrumb.tsx           # Caminho da página actual
│   ├── modules/
│   │   ├── auth/                    # Login, sessão, perfil
│   │   ├── dashboard/               # KPIs, mapa, alertas, gráficos
│   │   ├── relatorios/              # Relatórios executivo/inspeções/perdas/ML
│   │   ├── mobile/                  # Componentes PWA
│   │   ├── scoring/                 # Motor 9 regras (engine.ts local)
│   │   └── ingestao/                # Import CSV/Excel
│   ├── lib/
│   │   ├── supabase/                # Clientes server/client/middleware
│   │   ├── api/                     # auth, rateLimit, response (API REST)
│   │   ├── observability/           # Logger estruturado JSON
│   │   ├── concurrency.ts           # Pool de concorrência (runPool)
│   │   ├── utils.ts                 # Helpers de formatação
│   │   └── export.ts                # Export Excel (XLSX)
│   └── types/
│       └── database.ts              # Tipos gerados do schema Supabase
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_mock_data.sql
│   │   ├── 003_rls_fiscal_update_alertas.sql
│   │   ├── 004_ml_weights_config.sql   # Pesos ML + RLS ml_predicoes
│   │   ├── 006_balanco_avancado_config.sql
│   │   └── 007_api_keys.sql            # api_key_electra + índice
│   └── functions/
│       ├── scoring-engine/          # Motor scoring (Deno)
│       ├── send-sms/                # SMS via Twilio (Deno)
│       ├── ingest-data/             # Parse CSV/Excel (Deno)
│       ├── balanco-energetico/      # Balanço por zona/mês (Deno)
│       └── ml-scoring/              # Score ML heurístico (Deno)
└── public/
    ├── manifest.json                # PWA manifest
    ├── sw.js                        # Service Worker (offline support)
    └── icons/                       # Ícones PWA 192x192 e 512x512
```

---

## Base de Dados

10 tabelas principais em PostgreSQL via Supabase.

| Tabela | Descrição |
|--------|-----------|
| `perfis` | Estende `auth.users`; 5 roles |
| `subestacoes` | Transformadores com coordenadas GPS |
| `clientes` | Instalações com número de contador |
| `injecao_energia` | kWh injetado por subestação/mês |
| `faturacao_clientes` | Faturação mensal por cliente |
| `alertas_fraude` | Output do motor (score 0–100, status, motivo JSONB) |
| `relatorios_inspecao` | Resultado da inspeção com foto GPS |
| `importacoes` | Log de uploads CSV |
| `configuracoes` | Limiares e pesos configuráveis (motor + ML + API keys) |
| `ml_predicoes` | Predições ML por cliente/mês (heuristic_v1) |

### Ciclo de vida de um alerta

```
Pendente → Notificado_SMS → Pendente_Inspecao → Inspecionado
                                                      ↓
                              Fraude_Confirmada | Anomalia_Tecnica | Falso_Positivo
```

---

## Motor de Scoring

O motor aplica 9 regras graduais por cliente, seguindo dois filtros:

### Etapa A — Balanço Energético (Filtro Macro)
Calcula a perda percentual por subestação: `(kWh_injetado - kWh_faturado) / kWh_injetado`.  
Só avança para o filtro micro se a zona for **vermelha** (perda > 15%).

### Etapa B — 9 Regras Graduais (Filtro Micro)

| Regra | O que deteta | Pontos máx |
|-------|-------------|-----------|
| R1 | Queda súbita vs. média 6 meses (δ ≥ limiar) | 0–25 |
| R2 | Consumo anormalmente constante (CV baixo) | 0–15 |
| R3 | Desvio Z-score face ao cluster da mesma tarifa | 0–20 |
| R4 | Divergência sazonal cliente vs. subestação | 0–15 |
| R5 | Slow bleed: tendência descendente 3+ meses (regressão linear) | 0–10 |
| R6 | Rácio CVE/kWh anómalo (> 2σ da média da tarifa) | 0–5 |
| R7 | Reincidência — alertas confirmados nos últimos 12 meses | +5 bónus |
| R8 | Consumo atual < 20% do pico histórico | 0–5 |
| R9 | Multiplicador zona vermelha: `1 + min(0.3, (perda−15%) × 2)` | ×1.0–1.3 |

**Classificação final:**
- `score ≥ 75` → CRÍTICO
- `50 ≤ score < 75` → MÉDIO
- `score < 50` → não gera alerta

Os limiares são configuráveis em `/admin/configuracao` (tabela `configuracoes`).

---

## Score ML (Fase 2)

A edge function `ml-scoring` aplica uma **regressão logística heurística** com 7 features extraídas dos motivos R1–R8 de cada alerta de scoring.

### Como funciona

1. Para cada subestação ativa, busca todos os alertas com `score_risco ≥ 50` do mês anterior
2. Extrai features normalizadas: pontos_r1, pontos_r2, …, pontos_r8, reincidencia
3. Aplica a função: `sigmoid(6 × (Σ(feature_i × peso_i) − 0.5))`
4. Grava o resultado em `ml_predicoes` com `modelo_versao = "heuristic_v1"`

### Pesos (configuráveis)

Os pesos estão guardados em `configuracoes` com a chave `ml_pesos_v1` (JSON), permitindo ajuste sem redeploy. Após 100+ inspeções confirmadas, substituir `modelo_versao` por `"logistic_v1"` com pesos treinados em dados reais.

### Cron

O ML corre automaticamente no **dia 2 de cada mês às 03:00 UTC** via `GET /api/cron/ml`, processando todas as subestações com `runPool` (concorrência ≤ 5).

---

## Módulos

### Dashboard (`/dashboard`)
- KPIs: perdas totais CVE, alertas críticos/médios, taxa de confirmação, receita recuperada YTD
- Mapa React Leaflet com subestações coloridas por nível de perda
- Tabela de alertas recentes com ações rápidas
- Gráfico Top 5 transformadores por perda
- Gráfico de tendência de perdas nos últimos 12 meses

### Alertas (`/alertas`)
- Tabela paginada (15/página) com todos os alertas
- Filtros: mês, estado, zona
- Ações: enviar SMS, gerar ordem de inspeção, classificar pós-inspeção

### Relatórios (`/relatorios`)
Módulo com 5 tabs independentes:

| Tab | Descrição |
|-----|-----------|
| **Executivo** | KPIs financeiros, perdas vs. recuperado, ROI acumulado do sistema |
| **Inspeções** | Resultados por zona, taxa de sucesso, donut por resultado |
| **Perdas por Zona** | Radar chart, top subestações, zonas críticas |
| **Recidivismo** | Clientes reincidentes nos últimos 12 meses |
| **Análise Avançada** | Split perdas técnicas/comerciais, Índice de Recuperabilidade por subestação, evolução mensal |

Cada tab exporta os seus dados para Excel via botão de download unificado.

### Admin — Scoring (`/admin/scoring`)
- Execução manual do motor por subestação ou global
- Resultados em tempo real: % perda, zona, alertas gerados, duração

### Admin — Importar (`/admin/importar`)
- Upload de CSV/Excel de faturação e injeção
- Validação de colunas e feedback de erros linha a linha

### Admin — Utilizadores (`/admin/utilizadores`)
- CRUD completo: criar, editar (nome/role/zona), desativar
- Proteção anti-self-delete

### Admin — Configuração (`/admin/configuracao`)
- Edição dos limiares do motor em tempo real (sem redeploy)
- Inclui limiar de perdas técnicas estimadas (`perda_tecnica_estimada_pct`, default 5%)

### Admin — API Keys (`/admin/api-keys`)
- Listagem das chaves API ativas
- Endpoints disponíveis e instruções de rotação de chaves

### Mobile PWA (`/mobile`)
- **Roteiro do dia**: lista de alertas `Pendente_Inspecao` na zona do fiscal
- **Ficha de inteligência**: perfil do cliente, histórico de consumo, score detalhado
- **Relatório de inspeção**: câmara com marca d'água GPS+timestamp, resultado, tipo de fraude
- Suporte offline: relatórios guardados localmente via IndexedDB e sincronizados quando há ligação

---

## API REST Pública

A API REST pública permite integração programática por clientes externos (ex. Electra).

### Autenticação

Todas as rotas requerem `Authorization: Bearer <api_key>`. As chaves são guardadas em `configuracoes` com o prefixo `api_key_`.

```bash
curl -H "Authorization: Bearer <chave>" https://fiskix.vercel.app/api/v1/alertas
```

### Rate Limiting

60 pedidos/minuto por chave (janela deslizante in-memory). Excedido → HTTP 429.

### Endpoints

| Método | Rota | Parâmetros | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/v1/alertas` | `mes_ano`, `status`, `min_score`, `subestacao_id`, `limit`, `page` | Lista paginada de alertas |
| GET | `/api/v1/alertas/:id` | — | Detalhe completo de um alerta (cliente + subestação + motivo) |
| GET | `/api/v1/balanco` | `mes_ano` (obrigatório), `subestacao_id` | Balanço com split técnico/comercial por subestação |
| GET | `/api/v1/predicoes` | `mes_ano`, `min_score_ml`, `subestacao_id`, `limit`, `page` | Lista paginada de predições ML |

Todos os endpoints incluem headers `Access-Control-Allow-Origin: *` e `Cache-Control: no-store`. Respostas em formato JSON com envelope `{ data, meta }`.

### Gestão de Chaves

Para gerar uma nova chave API:
```bash
openssl rand -hex 32
# Inserir em configuracoes: UPDATE configuracoes SET valor = '<nova_chave>' WHERE chave = 'api_key_electra';
```

---

## Setup Local

```bash
# 1. Clonar o repositório
git clone https://github.com/hamiltonmoreno/fiskix.git
cd fiskix

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.local.example .env.local
# Editar .env.local e preencher os valores secretos (ver secção abaixo)

# 4. Aplicar migrations no Supabase (SQL Editor ou MCP)
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/002_mock_data.sql
# supabase/migrations/003_rls_fiscal_update_alertas.sql
# supabase/migrations/004_ml_weights_config.sql
# supabase/migrations/006_balanco_avancado_config.sql
# supabase/migrations/007_api_keys.sql

# 5. Executar testes (opcional)
npm run test

# 6. Arrancar em desenvolvimento
npm run dev
```

Abrir: [http://localhost:3000](http://localhost:3000)

### Credenciais demo (após migration 002)

| Role | Email | Password |
|------|-------|----------|
| Gestor de Perdas | `gestor@electra.cv` | `fiskix2026` |
| Fiscal | `fiscal@electra.cv` | `fiskix2026` |
| Diretor | `diretor@electra.cv` | `fiskix2026` |

---

## Variáveis de Ambiente

Copiar `.env.local.example` para `.env.local` e preencher:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL pública do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anónima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave service role (secreta) |
| `TWILIO_ACCOUNT_SID` | Para SMS | SID da conta Twilio |
| `TWILIO_AUTH_TOKEN` | Para SMS | Token de autenticação Twilio |
| `TWILIO_PHONE_NUMBER` | Para SMS | Número Twilio E.164 |
| `CRON_SECRET` | Para crons | Segredo partilhado para `/api/cron/scoring` e `/api/cron/ml` |

Obter valores em:
- Supabase: `https://supabase.com/dashboard/project/rqplobwsdbceuqhjywgt/settings/api`
- Twilio: `https://console.twilio.com`
- `CRON_SECRET`: `openssl rand -hex 32` (adicionar também no Vercel Dashboard)

---

## Deploy

O deploy é automático via Vercel ao fazer push para `main`.

### Variáveis no Vercel Dashboard

Configurar todas as variáveis de ambiente em:
**Vercel > fiskix > Settings > Environment Variables**

### Edge Functions (Supabase)

```bash
npx supabase functions deploy scoring-engine
npx supabase functions deploy send-sms
npx supabase functions deploy ingest-data
npx supabase functions deploy balanco-energetico
npx supabase functions deploy ml-scoring
```

---

## Edge Functions

| Função | Método | Payload | Descrição | Autorização |
|--------|--------|---------|-----------|-------------|
| `scoring-engine` | POST | `{ subestacao_id, mes_ano }` | Executa as 9 regras para uma subestação | JWT + role ou service role |
| `send-sms` | POST | `{ alerta_id, tipo }` | Envia SMS amarelo/vermelho ao cliente | JWT + role |
| `ingest-data` | POST | FormData CSV/Excel | Importa faturação ou injeção | JWT válido |
| `balanco-energetico` | GET/POST | `?mes_ano=YYYY-MM[&subestacao_id]` | Calcula perdas por zona | JWT + role ou service role |
| `ml-scoring` | POST | `{ subestacao_id, mes_ano }` | Regressão logística heurística, grava em `ml_predicoes` | Service role apenas |

---

## Roles e Permissões

| Role | Dashboard | Alertas | Relatórios | Admin | Mobile |
|------|-----------|---------|------------|-------|--------|
| `admin_fiskix` | Leitura/escrita | Total | Total | Total | — |
| `gestor_perdas` | Leitura/escrita | Total | Total | Parcial | — |
| `diretor` | Só leitura | Só leitura | Só leitura | — | — |
| `supervisor` | Leitura/escrita | Leitura | Leitura | — | — |
| `fiscal` | — | — | — | — | Só sua zona |

O RLS está ativo em todas as tabelas. O fiscal acede apenas a alertas `Pendente_Inspecao` na sua zona (`id_zona` no perfil).

---

## PWA Mobile

A app mobile é uma PWA instalável em Android Chrome.

- **Manifest:** `/public/manifest.json` — scope `/mobile`, ícones 192/512px
- **Service Worker:** `/public/sw.js`
  - Cache-first para assets estáticos (`/_next/static`, ícones)
  - Network-first para páginas `/mobile` e `/login`
  - Nunca cacheia pedidos não-GET (mutations Supabase)
  - Fallback offline via IndexedDB para relatórios de inspeção
  - Deteção de conectividade no arranque (`navigator.onLine`) para evitar sobrescrever cache quando a app abre offline
- **Registo:** automático no `mobile/layout.tsx` ao carregar a página

Para instalar: abrir `/mobile` no Chrome Android → menu → "Adicionar ao ecrã inicial".

---

## Qualidade e Testes

O Fiskix utiliza **Vitest** (unit/integration) e **Playwright** (E2E).

Atualmente:
- **300 testes automatizados** em **31 ficheiros** Vitest — 100% de sucesso
- **~19 cenários E2E** em **5 ficheiros** Playwright (auth, login, rotas protegidas, assets públicos, fluxos autenticados)

### Comandos de Teste

```bash
# Executar todos os testes
npm run test

# Executar testes com relatório de cobertura (coverage)
npm run test:coverage

# Executar linting e type-check
npm run lint
npm run type-check
```

### Pipeline de Qualidade (local/CI)

```bash
npm run lint
npm run type-check
npm run test
npm run e2e
npm run build
```

No GitHub, este fluxo é aplicado automaticamente pelo check obrigatório `Quality Gate` em Pull Requests para `main`.

### Áreas Cobertas pelos Testes Vitest

| Área | Ficheiros | Testes |
|------|-----------|--------|
| Motor de scoring (R1–R9, balanço, multiplicadores) | 1 | 48 |
| API REST pública (v1/alertas, balanco, predicoes) | 1 | 17 |
| Lib API (auth, rateLimit, parsePaginacao, apiError) | 1 | 18 |
| Cron scoring + cron ML | 2 | 22 |
| Dashboard (KPIs, mapa, heatmap, gráficos) | 4 | 12 |
| Relatórios (TabBalanco, TabAnaliseAvancada, TabExecutivo, TabInspecoes) | 4 | 22 |
| Hooks (useAuth, useAlertas, useKPIs, useRelatoriosData) | 4 | 27 |
| Mobile PWA (roteiro, ficha, relatório inspeção) | 3 | 9 |
| Admin (importar dados) | 1 | 3 |
| Utilitários (utils, export, concurrency, logger) | 4 | 27 |
| Auth (LoginForm, callback OAuth) | 2 | 10 |
| UI (Sidebar, Breadcrumb) | 2 | 4 |

---

## Testes E2E (Playwright)

Os testes E2E ficam em `e2e/` e usam `playwright.config.ts`.

### Comandos

```bash
# Instalar browser de teste (uma vez por máquina)
npm run e2e:install

# Suite E2E
npm run e2e

# Modo UI
npm run e2e:ui

# Debug interativo
npm run e2e:debug
```

### Cenários base (5 ficheiros, ~11 testes)

| Ficheiro | Cenários |
|----------|---------|
| `auth.spec.ts` | Redirect anónimo `/` → `/login`, `/dashboard` → `/login`, render form login |
| `login.spec.ts` | Campos email/password, rodapé de confidencialidade |
| `routes.spec.ts` | Rotas protegidas (`/alertas`, `/admin`, `/perfil`, `/mobile`) → `/login` |
| `public-assets.spec.ts` | Servir `manifest.json` e `sw.js` |
| `authenticated.spec.ts` | Fluxos autenticados (admin: dashboard, KPIs, navegação, bloqueio `/mobile`; fiscal: roteiro, bloqueio `/alertas`/`/admin`) — requerem variáveis de ambiente |

### Cenários autenticados (opcional)

Para ativar E2E de login real (admin/fiscal), definir:

```bash
FISKIX_E2E_ADMIN_EMAIL=...
FISKIX_E2E_ADMIN_PASSWORD=...
FISKIX_E2E_FISCAL_EMAIL=...
FISKIX_E2E_FISCAL_PASSWORD=...
```

Sem estas variáveis, os testes autenticados são marcados como `skipped`.

---

## Observabilidade

- Logs estruturados JSON em rotas server-side (via `src/lib/observability/logger.ts`)
- `request_id` propagado na resposta de todos os crons (`/api/cron/scoring`, `/api/cron/ml`)
- Crons com retry e timeout na chamada às edge functions
- Batches assíncronos via `runPool` com captura de erros por tarefa (não aborta o lote)
- Evento final de execução inclui `duration_ms`, `subestacoes_processadas`, `total_scored`, `erros`
- Hardening geral: todos os componentes e hooks usam `try/finally` para manter consistência de estados
- API REST com headers `x-request-id`, `Cache-Control: no-store` e CORS em todas as respostas

---

## Cron Automático

Dois jobs mensais geridos pelo Vercel Cron (configurados em `vercel.json`):

| Job | Schedule | Rota | O que faz |
|-----|----------|------|-----------|
| Scoring | `0 2 1 * *` | `/api/cron/scoring` | Executa as 9 regras para todas as subestações ativas |
| ML | `0 3 2 * *` | `/api/cron/ml` | Corre a regressão logística e grava predições em `ml_predicoes` |

Ambos são protegidos por `Authorization: Bearer <CRON_SECRET>`. O Vercel injeta o header automaticamente.

Para testar manualmente:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://fiskix.vercel.app/api/cron/scoring
curl -H "Authorization: Bearer <CRON_SECRET>" https://fiskix.vercel.app/api/cron/ml
```

---

## Roadmap

| Fase | Estado | Descrição |
|------|--------|-----------|
| **Fase 1** | ✅ Completo | MVP: scoring 9 regras, dashboard, mobile PWA, SMS, import CSV |
| **Fase 2** | ✅ Completo | Score ML heurístico, análise avançada de perdas, API REST pública |
| **Fase 3** | Futura | Modelo ML logístico com dados reais, dashboard de monitorização API, multi-tenant |
