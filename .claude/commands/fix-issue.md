---
description: Fix a GitHub issue by number
argument-hint: [issue-number]
---

Fix issue #$ARGUMENTS:

1. View issue: `gh issue view $ARGUMENTS`
2. Understand the bug from description
3. Find relevant code files using Grep/Glob
4. Cross-check against known fixed bugs in CLAUDE.md (section "Bugs já corrigidos")
5. Implement fix with smallest change possible
6. Write/update tests in `src/__tests__/` to prevent regression
7. Run `npm test` to verify all 300 tests still pass
8. Run `npm run type-check` to verify TypeScript
9. Reference the issue in commit message: `fix(scope): description — Fixes #$ARGUMENTS`

If the issue is unclear, ask one clarifying question before proceeding.
