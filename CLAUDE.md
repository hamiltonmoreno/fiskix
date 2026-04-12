# Fiskix — Contexto para Claude Code

## O que é o Fiskix

Plataforma SaaS de deteção de fraudes e perdas comerciais de energia elétrica. Cliente inicial: **Electra (Cabo Verde)**. **Fases 1 e 2 completas** (de 3).

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + TailwindCSS + Recharts + React Leaflet
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Deploy**: Vercel (frontend) + Supabase Edge Functions
- **SMS**: Twilio (alphanumeric sender "Electra" + fallback numérico)
- **Mobile**: PWA (Android Chrome) — rotas `/mobile`
- **Testes**: Vitest (300 testes automatizados em 31 ficheiros, 100% de sucesso)

## Supabase

- **Project ID**: `rqplobwsdbceuqhjywgt`
- **URL**: `https://rqplobwsdbceuqhjywgt.supabase.co`
- **Region**: eu-west-1

## Estrutura de Módulos

```text
src/modules/
  auth/          — login, sessão, perfil
  dashboard/     — Control Room (KPIs, mapa, alertas, TendenciaPerdas)
  mobile/        — PWA para fiscais (roteiro, inspeção, câmara GPS)
  scoring/       — Motor de 9 regras (engine.ts — lógica local)
  ingestao/      — Import CSV/Excel de faturação e injeção
  alertas/       — CRUD alertas_fraude (em /alertas, não em modules/)
  admin/         — utilizadores, configuração, importar

src/app/api/
  cron/scoring/  — Rota Next.js para cron Vercel (dia 1 de cada mês)

supabase/functions/
  scoring-engine      — Motor scoring (Deno)
  send-sms            — SMS via Twilio (Deno)
  ingest-data         — Parse CSV/Excel (Deno)
  balanco-energetico  — Perdas por subestação/zona (Deno)
```

## Base de Dados (10 tabelas)

- `perfis` — estende auth.users; roles: admin_fiskix, diretor, gestor_perdas, supervisor, fiscal
- `subestacoes` — transformadores com zona_bairro, coordenadas
- `clientes` — instalações com numero_contador, id_subestacao
- `injecao_energia` — kWh injetado por subestação/mês
- `faturacao_clientes` — faturação mensal por cliente
- `alertas_fraude` — output do motor (score 0–100, status, resultado, motivo JSONB)
- `relatorios_inspecao` — resultado de inspeção com foto GPS
- `importacoes` — log de uploads CSV
- `configuracoes` — limiares configuráveis do motor
- `ml_predicoes` — predições ML por cliente/mês (heuristic_v1, Fase 2)

## Motor de Scoring (9 Regras)

| Regra | O que deteta | Pontos |
| ----- | ------------ | ------ |
| R1 | Queda súbita de consumo vs média 6 meses | 0–25 |
| R2 | Consumo suspeitosamente constante (CV baixo) | 0–15 |
| R3 | Desvio face ao cluster da mesma tarifa | 0–20 |
| R4 | Divergência sazonal cliente vs subestação | 0–15 |
| R5 | Slow bleed: tendência descendente 3+ meses | 0–10 |
| R6 | Rácio CVE/kWh anómalo | 0–5 |
| R7 | Reincidência (alertas confirmados 12 meses) | +5 bónus |
| R8 | Consumo atual < 20% do pico histórico | 0–5 |
| R9 | Multiplicador zona vermelha (perda > 15%) | ×1.0–1.3 |

Score ≥ 75 → CRÍTICO; 50–74 → MÉDIO. Só pontuação em Zona Vermelha (perda > 15%).

## Fluxo Principal (Happy Path)

1. Gestor importa CSV → `/admin/importar`
2. Gestor executa scoring → `/admin/scoring` → alertas criados
3. Gestor gera SMS e ordens de inspeção → `/alertas`
4. Cron automático no dia 1 de cada mês → `/api/cron/scoring`
5. Fiscal abre PWA `/mobile` → vê roteiro → abre ficha → inspeção com foto GPS
6. Resultado sincronizado → receita recuperada atualizada no KPI

## Fase 2 implementada (Abril 2026)

### Feature 1 — Score ML (`ml_predicoes`)

- Edge function `ml-scoring` (Deno) — regressão logística heurística com 7 features extraídas dos motivos R1-R8
- Pesos guardados em `configuracoes` (chave `ml_pesos_v1`), actualizáveis sem deploy
- Cron automático: dia 2 de cada mês às 03:00 UTC (`/api/cron/ml`)
- `modelo_versao = "heuristic_v1"` — substituir por `"logistic_v1"` após 100+ inspeções confirmadas

### Feature 2 — Balanço Energético Avançado

- Nova tab "Análise Avançada" em `/relatorios` (TabAnaliseAvancada)
- Separação perdas técnicas vs comerciais (limiar configurável `perda_tecnica_estimada_pct`, default 5%)
- Índice de Recuperabilidade por subestação: `(alertas_críticos / total) × perda_pct`
- Evolução mensal técnica vs comercial em gráfico de área

### Feature 3 — API Pública REST

- `GET /api/v1/alertas` — lista com filtros (mes_ano, status, min_score, subestacao_id)
- `GET /api/v1/alertas/:id` — detalhe com motivo e dados do cliente
- `GET /api/v1/balanco` — balanço com split técnico/comercial
- `GET /api/v1/predicoes` — predições ML
- Autenticação por API key (`Authorization: Bearer <key>`) guardada em `configuracoes`
- Rate limit: 60 req/min por key (in-memory, adequado para PoC B2B)
- Página de gestão: `/admin/api-keys`
- **IMPORTANTE:** substituir valor de `api_key_electra` em configuracoes por chave real gerada com `openssl rand -hex 32`

## Status atual (Abril 2026)

- ✅ Auth + RLS completo (5 roles, isolamento por zona)
- ✅ Dashboard: KPIs, mapa React Leaflet, tabela alertas, gráficos Recharts, TendenciaPerdas 12 meses
- ✅ Módulo `/alertas` independente: CRUD completo, filtros, paginação, SMS, ordens
- ✅ Sidebar responsiva retrátil (desktop + mobile drawer) + Breadcrumb
- ✅ Motor scoring 9 regras (edge function + engine.ts local)
- ✅ Import CSV/Excel (ingest-data edge function)
- ✅ SMS Twilio com fallback
- ✅ App mobile PWA (roteiro, ficha inteligência, relatório inspeção com câmara GPS)
- ✅ Offline: IndexedDB + sync automático quando há ligação
- ✅ Admin: utilizadores, configuração, importar
- ✅ Cron automático mensal (Vercel Cron → /api/cron/scoring)
- ✅ Edge function balanco-energetico
- ✅ Deploy produção: Vercel + Supabase Edge Functions
- ✅ Branch protection automática com check obrigatório `Quality Gate` em PR para `main`
- ✅ Service Worker PWA corrigido (não cacheia POST/mutations)
- ✅ Roteiro mobile inicializa estado online pelo `navigator.onLine` para preservar fallback offline
- ✅ Testes: 300 testes integrados em 31 ficheiros (Vitest) + ~11 cenários E2E em 5 ficheiros (Playwright)
- ✅ Score ML heurístico (`ml_predicoes`) + cron dia 2 às 03:00 UTC (`/api/cron/ml`)
- ✅ Balanço Energético Avançado: split técnico/comercial + Índice de Recuperabilidade (`/relatorios` tab "Análise Avançada")
- ✅ API REST pública (`/api/v1/`) com auth por API key, rate limit 60 req/min, 4 endpoints
- ✅ Gestão de API keys (`/admin/api-keys`)
- ✅ Documentação completa (README, CONTRIBUTING, SECURITY)

## Bugs já corrigidos (não voltar a introduzir)

- RLS: fiscal só faz UPDATE em alertas `Pendente_Inspecao` na sua zona (migration 003)
- Scoring: INSERT só novos + UPDATE apenas status `Pendente` (não sobrescreve inspecionados)
- R5: threshold `meses >= 3` (tanto em engine.ts como edge function)
- R7: usa `.in(["Fraude_Confirmada", "Anomalia_Tecnica"])` — não `.neq()`
- SMS: normalização E.164 adiciona `+` se número não tiver prefixo
- KPIs: filtro por zona aplica-se também a injecao_energia e faturacao_clientes
- Login page: `export const dynamic = "force-dynamic"` para evitar pré-renderização estática
- SW: não fazer cache de pedidos não-GET (impedia mutations Supabase)
- Cron: recua um mês no cálculo de `mesAno` para processar dados consolidados do mês que acabou de terminar
- runPool: captura erros individuais dentro dos workers para garantir que o lote termina mesmo que uma tarefa falhe (resiliência)
- Hardening: uso de `try/finally` em todos os hooks e componentes com `setLoading` para evitar botões travados

## Variáveis de Ambiente necessárias (.env.local)

Ver `.env.local.example` — copiar para `.env.local` e preencher os valores secretos.
Os valores públicos (`NEXT_PUBLIC_*`) já estão preenchidos no exemplo.
Os valores secretos (service role key, Twilio, CRON_SECRET) obter de:

- Supabase: <https://supabase.com/dashboard/project/rqplobwsdbceuqhjywgt/settings/api>
- Twilio: <https://console.twilio.com>
- CRON_SECRET: `openssl rand -hex 32` (adicionar também no Vercel Dashboard)

## Setup num novo computador

```bash
git clone https://github.com/hamiltonmoreno/fiskix.git
cd fiskix
npm install
cp .env.local.example .env.local
# Editar .env.local e adicionar os valores secretos
npm run dev
# Para testar: npm run test
```
