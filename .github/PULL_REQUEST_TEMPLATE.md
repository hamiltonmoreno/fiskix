## Descrição

Descreva as alterações de forma clara e concisa. Inclua o contexto e a motivação.

## Tipo de Alteração

- [ ] `feat` — Nova funcionalidade
- [ ] `fix` — Correção de bug
- [ ] `docs` — Documentação
- [ ] `refactor` — Refactoring sem mudança de comportamento
- [ ] `chore` — Manutenção (deps, config, build)

## Issues Relacionadas

Fixes #

## Checklist

- [ ] `npm run build` passa sem erros
- [ ] Sem `any` no TypeScript — usar `unknown` + cast se necessário
- [ ] Alterações ao schema incluem migration em `supabase/migrations/`
- [ ] Se alterou `engine.ts`, a lógica está alinhada com `scoring-engine/index.ts`
- [ ] Se alterou `sw.js`, o `CACHE_NAME` foi incrementado
- [ ] Não há segredos, `.env.local` ou `console.log` no diff
- [ ] Commits seguem o formato `tipo: descrição` em português

## Como Testar

Descreva os passos para verificar as alterações:

1.
2.
3.

## Screenshots (se aplicável)
