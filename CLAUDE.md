# Fiskix — Contexto para Claude Code

## O que é o Fiskix
Plataforma SaaS de deteção de fraudes e perdas comerciais de energia elétrica. Cliente inicial: **Electra (Cabo Verde)**. Fase MVP/PoC (Fase 1 de 3).

## Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + TailwindCSS + Recharts + React Leaflet
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Deploy**: Vercel (frontend) + Supabase Edge Functions
- **SMS**: Twilio (alphanumeric sender "Electra" + fallback numérico)
- **Mobile**: PWA (Android Chrome) — rotas `/mobile`

## Supabase
- **Project ID**: `rqplobwsdbceuqhjywgt`
- **URL**: `https://rqplobwsdbceuqhjywgt.supabase.co`
- **Region**: eu-west-1

## Estrutura de Módulos
```
src/modules/
  auth/          — login, sessão, perfil
  dashboard/     — Control Room (KPIs, mapa, alertas)
  mobile/        — PWA para fiscais (roteiro, inspeção, câmara GPS)
  scoring/       — Motor de 9 regras (engine.ts — lógica local)
  ingestao/      — Import CSV/Excel de faturação e injeção
  alertas/       — CRUD alertas_fraude
  admin/         — utilizadores, configuração, importar

supabase/functions/
  scoring-engine — Motor scoring (Deno) — versão deployada
  send-sms       — SMS via Twilio (Deno)
  ingest-data    — Parse CSV/Excel (Deno)
  balanco-energetico — (futuro)
```

## Base de Dados (9 tabelas principais)
- `perfis` — estende auth.users; roles: admin_fiskix, diretor, gestor_perdas, supervisor, fiscal
- `subestacoes` — transformadores com zona_bairro, coordenadas
- `clientes` — instalações com numero_contador, id_subestacao
- `injecao_energia` — kWh injetado por subestação/mês
- `faturacao_clientes` — faturação mensal por cliente
- `alertas_fraude` — output do motor (score 0–100, status, motivo JSONB)
- `relatorios_inspecao` — resultado de inspeção com foto GPS
- `importacoes` — log de uploads CSV
- `configuracoes` — limiares configuráveis do motor

## Motor de Scoring (9 Regras)
| Regra | O que deteta | Pontos |
|-------|-------------|--------|
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
3. Gestor envia SMS amarelo/vermelho ao cliente
4. Gestor gera ordem de inspeção (status: Pendente_Inspecao)
5. Fiscal abre PWA `/mobile` → vê roteiro → abre ficha → inspeção com foto GPS
6. Resultado sincronizado → receita recuperada atualizada no KPI

## Status atual (Abril 2026)
- ✅ Auth + RLS completo (5 roles, isolamento por zona)
- ✅ Dashboard: KPIs, mapa React Leaflet, tabela alertas, gráficos Recharts
- ✅ Sidebar responsiva retrátil (desktop + mobile drawer)
- ✅ Motor scoring 9 regras (edge function + engine.ts local)
- ✅ Import CSV/Excel (ingest-data edge function)
- ✅ SMS Twilio com fallback
- ✅ App mobile PWA (roteiro, ficha inteligência, relatório inspeção com câmara GPS)
- ✅ Admin: utilizadores, configuração, importar
- ✅ Deploy produção: Vercel + Supabase Edge Functions

## Bugs já corrigidos (não voltar a introduzir)
- RLS: fiscal só faz UPDATE em alertas `Pendente_Inspecao` na sua zona
- Scoring: INSERT só novos + UPDATE apenas status `Pendente` (não sobrescreve inspecionados)
- R5: threshold `meses >= 3` (tanto em engine.ts como edge function)
- R7: usa `.in(["Fraude_Confirmada", "Anomalia_Tecnica"])` — não `.neq()`
- SMS: normalização E.164 adiciona `+` se número não tiver prefixo
- KPIs: filtro por zona aplica-se também a injecao_energia e faturacao_clientes

## Variáveis de Ambiente necessárias (.env.local)
Ver `.env.local.example` — copiar para `.env.local` e preencher os valores secretos.
Os valores públicos (`NEXT_PUBLIC_*`) já estão preenchidos no exemplo.
Os valores secretos (service role key, Twilio) obter de:
- Supabase: https://supabase.com/dashboard/project/rqplobwsdbceuqhjywgt/settings/api
- Twilio: https://console.twilio.com

## Setup num novo computador
```bash
git clone https://github.com/hamiltonmoreno/fiskix.git
cd fiskix
npm install
cp .env.local.example .env.local
# Editar .env.local e adicionar os valores secretos
npm run dev
```
