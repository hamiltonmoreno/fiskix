# Política de Segurança — Fiskix

## Versões Suportadas

| Versão | Suportada |
|--------|-----------|
| `main` (produção) | Sim |
| Branches de feature | Não |

---

## Âmbito

Esta política cobre vulnerabilidades em:
- Aplicação web Next.js (frontend e API routes)
- Edge Functions Supabase (scoring-engine, send-sms, ingest-data, balanco-energetico)
- Políticas RLS da base de dados
- Lógica de autenticação e autorização (RBAC por role)

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

### API Routes
- `/api/cron/scoring` protegida por `CRON_SECRET` (Bearer token)
- Edge Functions protegidas por JWT Supabase no header `Authorization`

### Headers de Segurança (Vercel)
Configurados em `vercel.json`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), geolocation=(self)` (apenas em `/mobile`)

### Dados Sensíveis
- Segredos em variáveis de ambiente — nunca hardcoded
- `.env.local` no `.gitignore`
- Fotos de inspeção em bucket privado Supabase Storage (`inspecoes`)

---

## Vulnerabilidades Conhecidas / Fora de Âmbito

- Ataques de força bruta ao login: mitigados pelo rate limiting do Supabase Auth
- Enumeração de utilizadores: o Supabase Auth retorna mensagem genérica
- XSS: Next.js escapa output por defeito; não há `dangerouslySetInnerHTML` com input do utilizador

---

## Reconhecimentos

Reportadores de vulnerabilidades responsáveis serão reconhecidos nas release notes da correção (com permissão).
