---
description: Refactor code following Fiskix conventions
argument-hint: [file-pattern or component-name]
---

Refactor $ARGUMENTS following project conventions:

1. Read the file(s) to understand current implementation
2. Check for:
   - Functions longer than 30 lines (extract helpers)
   - Deep nesting (use early returns)
   - Magic numbers/strings (extract constants)
   - `any` types (replace with proper types + Zod)
   - Default exports (convert to named exports)
   - Missing error handling with try/finally for setLoading
3. Ensure all changes maintain existing functionality
4. Run `npm run type-check` and `npm test` after refactoring
5. Provide before/after comparison of key changes

Do not change logic behavior, only structure and patterns.
Do not introduce new dependencies.
