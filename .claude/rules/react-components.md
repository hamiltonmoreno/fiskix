---
paths:
  - "src/**/*.tsx"
  - "src/**/*.ts"
---

## React Component Rules — Fiskix

### Component Structure
- Use Server Components by default in `app/` directory
- Add `'use client'` only when using hooks, browser APIs, or event handlers
- Props interfaces named `[Component]Props`, defined in same file
- Destructure props in function signature
- Named exports only — no default exports except Next.js page/layout files

### Styling
- Use Tailwind classes, never inline styles
- Use `cn()` utility for conditional classes
- Follow mobile-first responsive design (PWA `/mobile` routes must work on small screens)
- Dark mode: use `dark:` variants, never hardcode colors

### Performance
- Memoize expensive calculations with `useMemo`
- Use `useCallback` for event handlers passed to children
- Lazy load heavy components with `dynamic()` imports
- Keep component files under 150 lines — split if larger

### Error Handling
- Always use `try/finally` when toggling loading state: prevents stuck buttons
- This is a known past bug — do NOT omit `finally` in async handlers

### PWA / Mobile
- Routes under `/mobile` must handle offline state via IndexedDB
- Check `navigator.onLine` for initial state — do not assume connectivity
- Never cache POST/mutation requests in Service Worker

### Patterns
- Prefer composition over prop drilling
- Use React Context only for 3+ levels of prop drilling
- Loading states: use Suspense boundaries with skeleton components
- Scoring engine: use `engine.ts` local logic, never call scoring Edge Function from client
