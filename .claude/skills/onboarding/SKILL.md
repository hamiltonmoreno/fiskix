---
name: onboarding
description: Help new developers understand the Fiskix codebase structure and conventions
allowed-tools: Read, Glob, Grep
---

Help onboard a new developer to Fiskix:

1. Explain the overall architecture:
   - Next.js 15 App Router frontend on Vercel
   - Supabase backend (PostgreSQL + Auth + Storage + Edge Functions)
   - PWA for mobile inspectors (`/mobile` routes)

2. Walk through the 10 database tables and their relationships

3. Explain the scoring engine:
   - 9 rules (R1–R9) in `src/modules/scoring/engine.ts`
   - Score thresholds: ≥75 CRÍTICO, 50–74 MÉDIO
   - Zona Vermelha filter (R9 multiplier)

4. Show the main user flows:
   - Import CSV → Scoring → Alerts → SMS → Mobile inspection
   - Admin panel for configuration and user management

5. Explain development setup:
   ```bash
   git clone https://github.com/hamiltonmoreno/fiskix.git
   cd fiskix && npm install
   cp .env.local.example .env.local
   # Fill in secrets from Supabase and Twilio dashboards
   npm run dev
   npm test  # verify 300 tests pass
   ```

6. Highlight critical rules:
   - Never edit committed migration files
   - Never expose service_role key client-side
   - RLS must stay enabled on all tables
   - 300 tests must remain green

7. Point out known fixed bugs in CLAUDE.md to avoid reintroducing them
