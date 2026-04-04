# Guia de Contribuição — Fiskix

Obrigado pelo interesse em contribuir para o Fiskix. Este guia descreve as convenções e o processo de contribuição.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Setup do Ambiente](#setup-do-ambiente)
- [Fluxo de Trabalho](#fluxo-de-trabalho)
- [Convenções de Código](#convenções-de-código)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Estrutura de Branches](#estrutura-de-branches)
- [Testes e Verificação](#testes-e-verificação)

---

## Pré-requisitos

- Node.js 20+
- npm 10+
- Conta Supabase (ou acesso ao projeto existente)
- Git

---

## Setup do Ambiente

```bash
git clone https://github.com/hamiltonmoreno/fiskix.git
cd fiskix
npm install
cp .env.local.example .env.local
# Preencher .env.local com valores do Supabase e Twilio
npm run dev
```

Aplicar as migrations no SQL Editor do Supabase:
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_mock_data.sql
supabase/migrations/003_rls_fiscal_update_alertas.sql
```

---

## Fluxo de Trabalho

1. Criar uma branch a partir de `main`
2. Fazer as alterações
3. Verificar que o build passa: `npm run build`
4. Submeter um Pull Request para `main`

---

## Convenções de Código

### Linguagem
- **Código e comentários:** inglês (variáveis, funções, tipos)
- **UI e textos visíveis ao utilizador:** português europeu
- **Documentação e commits:** português europeu

### TypeScript
- Tipar sempre explicitamente em funções públicas
- Sem `any` — usar `unknown` com cast quando necessário (padrão já estabelecido no projeto)
- Usar os tipos gerados em `src/types/database.ts`

### Supabase / RLS
- Todas as queries usam o client anónimo (`createClient` de `@/lib/supabase/client`) no browser
- Server Components usam `createClient` de `@/lib/supabase/server`
- Nunca usar a service role key no browser
- Alterações ao schema → criar nova migration em `supabase/migrations/`

### Componentes React
- Client Components (`"use client"`) apenas quando necessário (estado, eventos, hooks)
- Server Components por defeito para páginas com dados Supabase
- Páginas que inicializam clientes Supabase devem ter `export const dynamic = "force-dynamic"`

### Estilos
- TailwindCSS — sem CSS custom a não ser em `globals.css`
- Paleta: `slate-*` para neutros, `blue-700` para ações primárias, `red-*` para crítico, `amber-*` para médio

### Edge Functions (Deno)
- Ficheiros em `supabase/functions/<nome>/index.ts`
- Sempre incluir CORS headers
- Usar `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` — nunca hardcoded

---

## Commits

Seguir o formato **Conventional Commits** em português:

```
<tipo>: <descrição curta no imperativo>

[corpo opcional — o que e porquê, não o como]
```

| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Alterações só em documentação |
| `refactor` | Reorganização sem mudar comportamento |
| `chore` | Tarefas de manutenção (deps, config) |
| `style` | Formatação, espaços, sem lógica |

Exemplos:
```
feat: adicionar filtro por zona na tabela de alertas

fix: corrigir cálculo de perdas quando kWh injetado é zero

docs: atualizar README com instruções de deploy Supabase
```

---

## Pull Requests

- Título em formato `tipo: descrição` (igual ao commit principal)
- Preencher o template de PR (`/.github/PULL_REQUEST_TEMPLATE.md`)
- O PR deve passar o build (`npm run build`) sem erros
- Descrever como testar as alterações
- Referenciar issues relacionadas com `Fixes #123`

### O que NÃO fazer num PR
- Não reformatar código não relacionado com a alteração
- Não adicionar comentários, docstrings ou logs de debug
- Não alterar `package-lock.json` manualmente
- Não commitar `.env.local` ou segredos

---

## Estrutura de Branches

| Branch | Propósito |
|--------|-----------|
| `main` | Produção — deploy automático para Vercel |
| `feature/<nome>` | Nova funcionalidade |
| `fix/<nome>` | Correção de bug |
| `docs/<nome>` | Documentação |

---

## Testes e Verificação

Antes de submeter um PR, verificar:

```bash
# Build de produção (obrigatório — não submeter se falhar)
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

### Verificações específicas do Fiskix

- **Motor de scoring:** se alterar `engine.ts`, verificar que a lógica é igual à edge function `scoring-engine/index.ts`
- **RLS:** se alterar políticas RLS, criar migration e testar com cada role
- **PWA:** se alterar `sw.js`, incrementar `CACHE_NAME` para invalidar o cache antigo
- **Edge Functions:** testar localmente com `npx supabase functions serve <nome>`

---

Para dúvidas, abrir uma [issue](https://github.com/hamiltonmoreno/fiskix/issues) com o label `question`.
