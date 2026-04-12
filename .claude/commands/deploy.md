---
description: Deploy application to specified environment
allowed-tools: Bash(git *), Bash(npm run *)
---

Deploy to $ARGUMENTS:

Valid environments: staging, production

Steps:
1. Check for uncommitted changes (`git status`)
2. Run full test suite (`npm test`)
3. Run typecheck (`npm run type-check`)
4. Run linter (`npm run lint`)
5. Build application (`npm run build`)
6. If staging: push to feature branch (Vercel creates preview automatically)
7. If production: ensure PR is merged to `main` (branch protection enforces Quality Gate)

Notes:
- Vercel deploys automatically on push to `main`
- Supabase Edge Functions: deploy via `supabase functions deploy <name>`
- CRON_SECRET must be set in Vercel Dashboard env vars

Confirm with me before any production action.
