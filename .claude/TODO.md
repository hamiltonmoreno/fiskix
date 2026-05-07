# Tarefas Pendentes — Fiskix

Ficheiro automaticamente lido em cada sessão. Apaga itens à medida que ficam concluídos.

## Deploy `parse-fatura-edec` v1 (PR #44 já merged)

A edge function `parse-fatura-edec` está em `supabase/functions/parse-fatura-edec/`
mas **ainda não foi deployada** — a tool `deploy_edge_function` do MCP server
está com glitch (Zod a coerce `files` array como string, devolve sempre
`ZodError`). Workarounds:

**Opção A (CLI local, mais directo):**
```bash
cd /home/user/fiskix
supabase login                # se necessário
supabase link --project-ref rqplobwsdbceuqhjywgt
supabase functions deploy parse-fatura-edec
```

**Opção B (Supabase Dashboard):**
1. https://supabase.com/dashboard/project/rqplobwsdbceuqhjywgt/functions
2. New Function → `parse-fatura-edec`
3. Upload de `supabase/functions/parse-fatura-edec/index.ts` + `parser.ts` +
   `_shared/cors.ts`
4. `verify_jwt = true`

**Opção C (esperar):** retentar o MCP daqui a algumas horas (pode ser
glitch transitório do server).

Após deploy, validar com curl:
```bash
curl -i -X OPTIONS https://rqplobwsdbceuqhjywgt.supabase.co/functions/v1/parse-fatura-edec \
  -H "Origin: https://example.com"
# Esperado: HTTP 200, Access-Control-Allow-Origin: *
```

Sem este deploy, `/admin/parse-fatura` na UI mostrará erro ao tentar
processar — frontend está pronto, falta só a edge function viva.

## Activar allowlist CORS em produção (PR #39)

As 5 edge functions foram deployadas com suporte a allowlist CSV
(`balanco-energetico` v3, `send-sms` v9, `ingest-data` v7, `ml-scoring` v2,
`scoring-engine` v8). **Por defeito devolvem `*`** (compat retroativa) — para
restringir aos browsers permitidos:

1. Login como `admin_fiskix`.
2. Ir a `/admin/configuracao`.
3. Definir chave `api_v1_allowed_origins` com CSV das origins permitidas:
   ```
   https://erp.electra.cv,https://admin.electra.cv,https://fiskix.vercel.app
   ```
4. Cache propaga em ≤5 min (TTL em-memória do worker). Não precisa redeploy.

A mesma chave é usada por `/api/v1/` (Next.js) desde PR #18.

## Smoke test CORS pós-deploy

Sandbox actual bloqueia egress para `*.supabase.co`. Validar manualmente fora
do sandbox:

```bash
# Wildcard (allowlist vazia)
curl -i -X OPTIONS https://rqplobwsdbceuqhjywgt.supabase.co/functions/v1/balanco-energetico \
  -H "Origin: https://example.com"
# Esperado: HTTP 200, Access-Control-Allow-Origin: *

# Após preencher allowlist:
curl -i -X OPTIONS https://rqplobwsdbceuqhjywgt.supabase.co/functions/v1/balanco-energetico \
  -H "Origin: https://erp.electra.cv"
# Esperado: HTTP 200, Access-Control-Allow-Origin: https://erp.electra.cv

curl -i -X OPTIONS https://rqplobwsdbceuqhjywgt.supabase.co/functions/v1/balanco-energetico \
  -H "Origin: https://atacante.example"
# Esperado: HTTP 200, Access-Control-Allow-Origin: null  (browser bloqueia)
```

Repetir para as outras 5 functions (`send-sms`, `ingest-data`, `ml-scoring`,
`scoring-engine`, `parse-fatura-edec`).
