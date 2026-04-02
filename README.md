# Fiskix — Fiscalização Inteligente de Energia

Plataforma SaaS de deteção de fraudes e perdas comerciais de energia para a Electra (Cabo Verde).

## Quick Start

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e preencher variáveis de ambiente
cp .env.local.example .env.local

# 3. Arrancar em desenvolvimento
npm run dev
```

Abrir: http://localhost:3000

## Setup Supabase

1. Criar projeto em [supabase.com](https://supabase.com)
2. Preencher `.env.local` com `SUPABASE_URL` e `SUPABASE_ANON_KEY`
3. Correr migrations no SQL Editor do Supabase:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_mock_data.sql`
4. Deploy das Edge Functions:
   ```bash
   npx supabase functions deploy scoring-engine
   npx supabase functions deploy send-sms
   npx supabase functions deploy ingest-data
   ```

## Estrutura

```
src/modules/
├── auth/          Login + RBAC
├── dashboard/     KPIs, mapa, gráficos, alertas
├── mobile/        PWA para fiscais (3 ecrãs)
├── scoring/       Motor 9 regras graduais v2
├── ingestao/      Import CSV/Excel
└── admin/         Utilizadores + configuração

supabase/
├── migrations/    Schema SQL + dados mock
└── functions/     Edge Functions (Deno)
```

## Roles

| Role | Acesso |
|------|--------|
| `admin_fiskix` | Total |
| `gestor_perdas` | Dashboard + Admin |
| `diretor` | Dashboard só leitura |
| `fiscal` | Apenas PWA mobile |

## Motor de Scoring v2

9 regras graduais + balanço energético:
- R1: Queda Súbita (0-25 pts)
- R2: Variância Zero (0-15 pts)
- R3: Desvio de Cluster (0-20 pts)
- R4: Divergência Sazonal (0-15 pts)
- R5: Tendência Descendente (0-10 pts) ★
- R6: Rácio CVE/kWh (0-5 pts) ★
- R7: Reincidência (+5 bónus) ★
- R8: Pico Histórico vs Atual (0-5 pts) ★
- R9: Contágio de Zona (×1.0-1.3) ★

★ = Regras novas vs motor original
