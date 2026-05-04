---
description: Run full quality gate before pushing to main (lint + typecheck + 300 tests)
allowed-tools: Bash(npm run *), Bash(npm test *), Bash(git status)
---

Run the full Fiskix quality gate:

1. Check git status: `git status`
2. Run linter: `npm run lint`
3. Run typecheck: `npm run type-check`
4. Run the 300 tests: `npm test`
5. Report final result — PASS or FAIL with details

If any step fails, stop and report which check failed and why.
Do NOT push or commit — only report results.
Use this before creating PRs or pushing to main.
