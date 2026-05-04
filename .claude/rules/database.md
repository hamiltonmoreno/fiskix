---
paths:
  - "supabase/migrations/**/*.sql"
  - "supabase/functions/**/*.ts"
  - "src/lib/**/*.ts"
  - "src/modules/**/queries*.ts"
---

## Database Rules — Fiskix (Supabase/PostgreSQL)

### Migrations
- NEVER edit existing migration files — always create new ones
- Migration naming: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Test migrations locally before committing
- Ask user before running `apply_migration` in production

### Schema (10 tables)
- `perfis`, `subestacoes`, `clientes`, `injecao_energia`, `faturacao_clientes`
- `alertas_fraude`, `relatorios_inspecao`, `importacoes`, `configuracoes`, `ml_predicoes`
- All tables have `created_at` and `updated_at` timestamps
- `database.types.ts` is auto-generated — NEVER edit manually

### Row Level Security (RLS)
- RLS is ENABLED on all 10 tables — no exceptions
- Policies must use `auth.uid()` — never trust client-provided user IDs
- Fiscal role: UPDATE only on `alertas_fraude` with status `Pendente_Inspecao` in their zone
- Reference migration 003 for fiscal RLS patterns

### Queries
- Use Supabase client from `lib/supabase/` for all queries
- Batch operations to reduce round trips
- Use transactions for multi-step operations (scoring inserts)
- Scoring: INSERT only new alerts + UPDATE only `Pendente` status (never overwrite inspected)

### Configuracoes Table
- Stores ML weights, thresholds, API keys, and feature flags
- API key for Electra stored under `api_key_electra` — must be real value from `openssl rand -hex 32`
- ML weights stored under `ml_pesos_v1` — updatable without deploy

### Roles
- `admin_fiskix`, `diretor`, `gestor_perdas`, `supervisor`, `fiscal`
- Isolation by zone (zona_bairro) enforced at RLS level
