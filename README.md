# Fiskix — Fiscalização Inteligente de Energia

Plataforma SaaS de deteção de fraudes e perdas comerciais de energia elétrica.  
Cliente inicial: **Electra (Cabo Verde)** — Fase MVP/PoC (Fase 1 de 3).

**Produção:** [fiskix.vercel.app](https://fiskix.vercel.app)

---

## Índice

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Base de Dados](#base-de-dados)
- [Motor de Scoring](#motor-de-scoring)
- [Módulos](#módulos)
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
│   │   ├── mobile/                  # PWA fiscal
│   │   │   ├── page.tsx             # Roteiro do dia
│   │   │   ├── [id]/page.tsx        # Ficha de inteligência
│   │   │   └── [id]/report/         # Relatório de inspeção
│   │   ├── admin/                   # Painel de administração
│   │   │   ├── scoring/             # Motor de scoring (manual)
│   │   │   ├── importar/            # Import CSV/Excel
│   │   │   ├── utilizadores/        # CRUD utilizadores
│   │   │   └── configuracao/        # Limiares do motor
│   │   └── api/
│   │       └── cron/scoring/        # Cron automático mensal
│   ├── __tests__/                   # Suite de testes (Vitest)
│   │   ├── engine.test.ts           # Testes do motor de scoring
│   │   ├── useAuth.test.ts          # Testes de autenticação
│   │   └── ...                      # Testes de UI e PWA
│   ├── components/
│   │   ├── Sidebar.tsx              # Navegação lateral responsiva
│   │   └── Breadcrumb.tsx           # Caminho da página actual
│   ├── modules/
│   │   ├── auth/                    # Login, sessão, perfil
│   │   ├── dashboard/               # KPIs, mapa, alertas, gráficos
│   │   ├── mobile/                  # Componentes PWA
│   │   ├── scoring/                 # Motor 9 regras (engine.ts local)
│   │   └── ingestao/                # Import CSV/Excel
│   ├── lib/
│   │   └── supabase/                # Clientes server/client/middleware
│   └── types/
│       └── database.ts              # Tipos gerados do schema Supabase
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # Schema + RLS + índices
│   │   ├── 002_mock_data.sql        # Dados demo (Cabo Verde)
│   │   └── 003_rls_fiscal_update_alertas.sql
│   └── functions/
│       ├── scoring-engine/          # Motor scoring (Deno)
│       ├── send-sms/                # SMS via Twilio (Deno)
│       ├── ingest-data/             # Parse CSV/Excel (Deno)
│       └── balanco-energetico/      # Balanço por zona/mês (Deno)
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
| `configuracoes` | Limiares configuráveis do motor |
| `ml_predicoes` | Reservado para Fase 2 (ML) |

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

## Módulos

### Dashboard (`/dashboard`)
- KPIs: perdas totais CVE, alertas críticos/médios, taxa de confirmação, receita recuperada
- Mapa React Leaflet com subestações coloridas por nível de perda
- Tabela de alertas recentes com ações rápidas
- Gráfico Top 5 transformadores por perda
- Gráfico de tendência de perdas nos últimos 12 meses

### Alertas (`/alertas`)
- Tabela paginada (15/página) com todos os alertas
- Filtros: mês, estado, zona
- Ações: enviar SMS, gerar ordem de inspeção, classificar pós-inspeção

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

### Mobile PWA (`/mobile`)
- **Roteiro do dia**: lista de alertas `Pendente_Inspecao` na zona do fiscal
- **Ficha de inteligência**: perfil do cliente, histórico de consumo, score detalhado
- **Relatório de inspeção**: câmara com marca d'água GPS+timestamp, resultado, tipo de fraude
- Suporte offline: relatórios guardados localmente via IndexedDB e sincronizados quando há ligação

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

# 4. Aplicar migrations no Supabase (SQL Editor)
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/002_mock_data.sql
# supabase/migrations/003_rls_fiscal_update_alertas.sql

# 5. Executar testes (opcional)
npm run test
npm run e2e:install
npm run e2e

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
| `CRON_SECRET` | Para cron | Segredo para proteger `/api/cron/scoring` |

Obter valores em:
- Supabase: `https://supabase.com/dashboard/project/rqplobwsdbceuqhjywgt/settings/api`
- Twilio: `https://console.twilio.com`
- `CRON_SECRET`: `openssl rand -hex 32`

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
```

---

## Edge Functions

| Função | Método | Payload | Descrição | Autorização |
|--------|--------|---------|-----------|-------------|
| `scoring-engine` | POST | `{ subestacao_id, mes_ano }` | Executa as 9 regras para uma subestação | JWT + role (`admin_fiskix`, `diretor`, `gestor_perdas`, `supervisor`) ou chamada interna com service role |
| `send-sms` | POST | `{ alerta_id, tipo }` | Envia SMS amarelo/vermelho ao cliente | JWT + role (`admin_fiskix`, `diretor`, `gestor_perdas`, `supervisor`) |
| `ingest-data` | POST | FormData com ficheiro CSV/Excel | Importa faturação ou injeção | JWT válido |
| `balanco-energetico` | GET/POST | `?mes_ano=YYYY-MM[&subestacao_id]` | Calcula perdas agregadas por zona | JWT + role (`admin_fiskix`, `diretor`, `gestor_perdas`, `supervisor`, `fiscal`) ou chamada interna com service role |

---

## Roles e Permissões

| Role | Dashboard | Alertas | Admin | Mobile |
|------|-----------|---------|-------|--------|
| `admin_fiskix` | Leitura/escrita | Total | Total | — |
| `gestor_perdas` | Leitura/escrita | Total | Parcial | — |
| `diretor` | Só leitura | Só leitura | — | — |
| `supervisor` | Leitura/escrita | Leitura | — | — |
| `fiscal` | — | — | — | Só sua zona |

O RLS (Row Level Security) está ativo em todas as tabelas. O fiscal acede apenas a alertas `Pendente_Inspecao` na sua zona (`id_zona` no perfil).

---

## PWA Mobile

A app mobile é uma PWA instalável em Android Chrome.

- **Manifest:** `/public/manifest.json` — scope `/mobile`, ícones 192/512px
- **Service Worker:** `/public/sw.js`
  - Cache-first para assets estáticos (`/_next/static`, ícones)
  - Network-first para páginas `/mobile` e `/login`
  - Nunca cacheia pedidos não-GET (mutations Supabase)
  - Fallback offline via IndexedDB para relatórios de inspeção
- **Registo:** automático no `mobile/layout.tsx` ao carregar a página

Para instalar: abrir `/mobile` no Chrome Android → menu → "Adicionar ao ecrã inicial".

---

## Qualidade e Testes

O Fiskix utiliza **Vitest** (unit/integration) e **Playwright** (E2E).

Atualmente:
- **172 testes automatizados** em Vitest
- **3 cenários E2E iniciais** em Playwright (auth/redirect/login)

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

### Pipeline de Qualidade Recomendada (local/CI)

```bash
npm run lint
npm run type-check
npm run test
npm run e2e
npm run build
```

No GitHub, este fluxo é aplicado automaticamente pelo check obrigatório `Quality Gate` em Pull Requests para `main`.

### Áreas Cobertas
- **Motor de Scoring:** R1 a R9, lógica de balanço e multiplicadores.
- **PWA Mobile:** Roteiro offline, ficha de inteligência e relatórios com mock de GPS.
- **Dashboard:** Gráficos Recharts, Mapas Leaflet e KPICards.
- **Autenticação:** Sessão, persistência de perfil e logout.
- **Ingestão:** Upload de CSV, validação de preview e erros de linha.

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

### Cenários base atuais
- Redirect de utilizador anónimo `/` → `/login`
- Redirect de utilizador anónimo `/dashboard` → `/login`
- Render da página de login com campos e ação principal
- Rotas protegidas anónimas (`/alertas`, `/admin`, `/perfil`, `/mobile`) redirecionam para `/login`
- Smoke tests de assets públicos (`/manifest.json`, `/sw.js`)

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
- `request_id` propagado na resposta da rota de cron (`/api/cron/scoring`)
- Cron com retry e timeout na chamada à edge function `scoring-engine`
- Evento final de execução inclui duração (`duration_ms`) e métricas agregadas

---

## Cron Automático

O scoring corre automaticamente no **dia 1 de cada mês às 02:00 UTC** via Vercel Cron.

- **Rota:** `GET /api/cron/scoring`
- **Schedule:** `0 2 1 * *`
- **Proteção:** header `Authorization: Bearer <CRON_SECRET>`
- O Vercel injeta o header automaticamente se `CRON_SECRET` estiver configurado

Para testar manualmente:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://fiskix.vercel.app/api/cron/scoring
```

---

## Roadmap

| Fase | Estado | Descrição |
|------|--------|-----------|
| **Fase 1** | ✅ Completo | MVP: scoring, dashboard, mobile, SMS, import |
| **Fase 2** | Planeada | Modelo ML (`ml_predicoes`), balanço energético avançado |
| **Fase 3** | Futura | API pública, integração AMI, multi-tenant |
