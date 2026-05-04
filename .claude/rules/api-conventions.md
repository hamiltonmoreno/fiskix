---
paths:
  - "src/app/api/**/*.ts"
  - "supabase/functions/**/*.ts"
---

## API Development Rules — Fiskix

### Request Handling
- Validate ALL inputs with Zod before business logic
- Return consistent shape: `{ success: boolean, data: T, error: string | null }`
- Use appropriate HTTP status codes (400 client error, 401 unauthorized, 500 server error)

### Authentication
- Check auth with `supabase.auth.getUser()` — never trust headers directly
- Return 401 if authentication missing or invalid
- For cron routes: validate `Authorization: Bearer ${CRON_SECRET}`
- For REST API v1: validate `Authorization: Bearer <api_key>` against `configuracoes` table

### Error Handling
- Never expose stack traces or internal details to client
- Log full error server-side, send sanitized message to client
- Always use `try/finally` when setting loading state to prevent stuck UI

### Supabase
- Use `supabase` client from `lib/supabase/` — never instantiate directly in routes
- Use service_role only in server-side code (Edge Functions, API routes)
- Never expose service_role key in any client-side code
- RLS enforces data isolation — trust it, don't duplicate in JS

### Rate Limiting
- REST API v1: 60 req/min per API key (in-memory counter, adequate for B2B PoC)
- Do not bypass rate limiting for any reason
