---
description: Review code for bugs, security and best practices
allowed-tools: Read, Grep, Glob, Agent
---

Review the latest changes for these issues:
- Security vulnerabilities (XSS, injection, CSRF, exposed secrets, RLS bypass)
- Performance bottlenecks (unnecessary re-renders, N+1 queries, missing indexes)
- Best practice violations and anti-patterns
- Missing error handling and edge cases
- Type safety issues (`any` types, missing Zod validation)
- Supabase-specific: service_role key exposure, auth.uid() usage in policies

Focus specifically on: $ARGUMENTS

Output as a markdown table:
| File | Line | Severity | Issue | Suggestion |

Be direct and specific. Skip generic compliments.
