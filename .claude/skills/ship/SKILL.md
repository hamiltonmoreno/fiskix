---
name: ship
description: Full pre-flight checks and commit/push to main. Runs typecheck → tests → fixes any blockers → commits with a conventional message → pushes. Use before any commit to main.
allowed-tools: Read, Edit, Glob, Grep, Bash
---

Ship the current changes to main. Follow these steps in order:

## 1. Type-check
Run `npm run type-check` and capture all errors.

- If there are errors **only in files you haven't touched**, fix them with minimal non-null assertions (`!`) or optional chaining (`?.`). These are pre-existing strict-null violations — fix them cleanly rather than suppressing.
- If there are errors in files you changed, identify and fix the root cause before continuing.
- Re-run until clean (zero errors).

## 2. Full test suite
Run `npm test` and confirm all 604 tests pass.

- If any test fails, fix the underlying code — do not modify or skip the test unless it is clearly wrong.
- Re-run until all pass.

## 3. Lint
Run `npm run lint` and check for errors (not warnings). Fix any errors before continuing.

## 4. Commit
Stage all relevant changes (never stage `.env*` or secret files). Write a conventional commit message:

```
<type>: <summary under 72 chars>

<body: what changed and why — one paragraph, bullet points for multi-item changes>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `fix`, `feat`, `refactor`, `test`, `docs`, `chore`.

Use `fix` for bug fixes, `feat` for new functionality, `refactor` for structural improvements.

## 5. Push
Push to `origin main`. If the push is rejected (non-fast-forward), stop and report — do not force push.

## 6. Report
Confirm the commit hash and summarize what was shipped in 2–3 lines.
