/**
 * Returns `next` if it is a safe same-origin path, otherwise `/dashboard`.
 *
 * Blocks open-redirect tricks:
 *   - protocol-relative URLs starting with `//` (e.g. `//evil.com`)
 *   - backslash-prefixed paths (`/\evil` — some browsers normalise to `//evil`)
 *   - any value not starting with a single forward slash (full URLs,
 *     `javascript:` URIs, relative paths, empty strings, etc.)
 */
export function safeRedirect(next: string): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}
