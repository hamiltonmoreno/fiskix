---
paths:
  - "src/__tests__/**/*.ts"
  - "src/__tests__/**/*.tsx"
  - "e2e/**/*.ts"
---

## Testing Rules — Fiskix

### Current State
- 300 automated tests across 31 files (Vitest) — ALL must pass
- E2E tests with Playwright in `e2e/`
- Coverage tracked via `npm run test:coverage`

### Test Structure
- Use `describe`/`it` format with clear descriptions
- Test files in `src/__tests__/` mirroring source structure
- E2E tests for critical flows: login, import CSV, scoring, SMS, mobile inspection

### Coverage Requirements
- All scoring rules (R1–R9) must have unit tests in engine
- All API routes must have integration tests
- PWA offline behavior must have tests

### Mocking
- Mock Supabase client for unit tests
- Mock Twilio for SMS tests — never call real SMS in tests
- Use `vi.mock()` for external dependencies
- Never mock Zod validators — let them validate real shapes

### Assertions
- Test behavior, not implementation details
- Use realistic test data (real-looking meter readings, not `foo`/`1234`)
- Assert on user-visible outcomes when testing components

### Commands
```bash
npm test                    # Run all 300 tests once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm run e2e                 # Playwright E2E
npm run e2e:ui              # Playwright UI mode (debug)
npm run e2e:headed          # Visible browser
```
