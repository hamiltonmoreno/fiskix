# Política de Segurança — Fiskix

## Versões Suportadas

| Versão | Suportada |
|--------|-----------|
| `main` (produção) | Sim |
| Branches de feature | Não |

---

## Âmbito

Esta política cobre vulnerabilidades em:
- Aplicação web Next.js (frontend e API routes, incluindo API REST pública `/api/v1/`)
- Edge Functions Supabase (scoring-engine, send-sms, ingest-data, balanco-energetico, ml-scoring)
- Políticas RLS da base de dados
- Lógica de autenticação e autorização (RBAC por role + API keys)

---

## Reportar uma Vulnerabilidade

**Não divulgar publicamente** até que o problema esteja corrigido.

Enviar um relatório detalhado para: **amiltonmoreno2010@gmail.com**

O relatório deve incluir:
1. Descrição clara da vulnerabilidade
2. Passos reproduzíveis (incluindo payloads ou requests de exemplo)
3. Impacto potencial (quais dados ou roles estão expostos)
4. Sugestão de correção, se existir

Resposta esperada em **48 horas**. Correção e deploy em **7 dias** para vulnerabilidades críticas.

---

## Boas Práticas Implementadas

### Autenticação
- Supabase Auth com JWT — sessões geridas por cookies HttpOnly
- Middleware Next.js verifica sessão em todas as rotas protegidas
- Fiscais redirecionados para `/mobile`; não-fiscais não acedem a `/mobile`

### Autorização (RLS)
- Row Level Security ativo em todas as 10 tabelas
- Fiscal: acesso apenas a alertas `Pendente_Inspecao` na sua `id_zona`
- Service Role Key usada apenas em Edge Functions e API routes server-side — nunca no browser

### API REST Pública (`/api/v1/`)
- Autenticação por API key (`Authorization: Bearer <chave>`) verificada em `configuracoes` (prefixo `api_key_`)
- Rate limiting in-memory: 60 pedidos/minuto por chave — resposta 429 quando excedido
- Sem exposição de dados pessoais além do necessário para integração B2B
- Chaves guardadas na base de dados — nunca hardcoded ou no repositório
- Rotação de chaves: `openssl rand -hex 32` + `UPDATE configuracoes SET valor = '...'`

### Rotas de Cron (`/api/cron/`)
- `/api/cron/scoring` e `/api/cron/ml` protegidas por `CRON_SECRET` (Bearer token)
- Fail-fast quando `CRON_SECRET` não está configurado (HTTP 500 imediato)
- `x-request-id` incluído na resposta para rastreabilidade de ponta a ponta
- Processamento em lote com `runPool` — erros individuais não abortam o lote mas são registados

### Edge Functions
- `send-sms`: JWT válido + allowlist de roles
- `scoring-engine`: JWT válido + allowlist de roles ou chamada interna service-to-service
- `balanco-energetico`: JWT válido + allowlist de roles ou chamada interna service-to-service
- `ml-scoring`: service role apenas (nunca chamada direta do browser)
- `ingest-data`: JWT válido

### Headers de Segurança (Vercel)
Configurados em `vercel.json`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), geolocation=(self)` (apenas em `/mobile`)
- API REST: `Cache-Control: no-store` + `Access-Control-Allow-Origin: *`

### Proteção de Branches (GitHub)
- `main` e `master` com branch protection gerida por workflow
- Check obrigatório `Quality Gate` para Pull Requests antes de merge
- Revisão obrigatória e proteção contra force-push/delete

### Dados Sensíveis
- Segredos em variáveis de ambiente — nunca hardcoded
- `.env.local` no `.gitignore`
- Fotos de inspeção em bucket privado Supabase Storage (`inspecoes`)
- API keys armazenadas em `configuracoes` (na base de dados) — não versionadas

### Gestão de Segredos (resposta a incidente)

Se qualquer segredo for exposto em commit/log/screenshot:
1. Revogar/rotacionar imediatamente no provedor (Supabase, Twilio, Vercel)
2. Para API keys: `UPDATE configuracoes SET valor = '<nova_chave>' WHERE chave = 'api_key_<cliente>'`
3. Remover a referência do código e bloquear futuros commits (`.gitignore`)
4. Reescrever histórico git apenas se necessário
5. Registar o incidente e validar impacto

---

## Vulnerabilidades Conhecidas / Fora de Âmbito

- Ataques de força bruta ao login: mitigados pelo rate limiting do Supabase Auth
- Enumeração de utilizadores: o Supabase Auth retorna mensagem genérica
- XSS: Next.js escapa output por defeito; não há `dangerouslySetInnerHTML` com input do utilizador
- Rate limit da API REST é in-memory (reinicia com redeploy) — adequado para PoC B2B; a substituir por Redis em produção multi-instância

---

## Reconhecimentos

Reportadores de vulnerabilidades responsáveis serão reconhecidos nas release notes da correção (com permissão).
