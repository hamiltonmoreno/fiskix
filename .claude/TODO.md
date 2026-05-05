# Tarefas Pendentes — Fiskix

Ficheiro automaticamente lido em cada sessão. Apaga itens à medida que ficam concluídos.

## Activar allowlist CORS em produção (PR #39)

As 5 edge functions foram deployadas com suporte a allowlist CSV
(`balanco-energetico` v3, `send-sms` v9, `ingest-data` v6, `ml-scoring` v2,
`scoring-engine` v7). **Por defeito devolvem `*`** (compat retroativa) — para
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

Repetir para as outras 4 functions (`send-sms`, `ingest-data`, `ml-scoring`,
`scoring-engine`).
