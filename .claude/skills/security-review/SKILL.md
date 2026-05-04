---
name: security-review
description: Comprehensive security audit. Use when reviewing code for vulnerabilities, before deployments, or when the user mentions security.
allowed-tools: Read, Grep, Glob, Bash
---

Perform a comprehensive security audit of the Fiskix codebase:

1. Check for exposed secrets (API keys, Supabase service_role key, Twilio credentials, CRON_SECRET)
2. Look for SQL injection vulnerabilities in Supabase queries
3. Check for XSS vulnerabilities in user input handling
4. Verify CSRF protection on forms and state-changing operations
5. Check authentication and authorization logic (auth.uid() usage)
6. Verify RLS is active on all 10 tables — any table missing RLS is critical
7. Check that service_role key is never in client-side code
8. Check API key validation in `/api/v1/*` routes
9. Look for insecure dependencies (`npm audit`)
10. Verify environment variables are not committed (.env.local, secrets)
11. **Scoring engine parity**: verify `src/modules/scoring/engine.ts` and `supabase/functions/scoring-engine/` implement the same R1–R9 logic and thresholds — divergence is a silent data integrity bug

For each finding:
- Severity: Critical, High, Medium, Low
- Location: File and line number
- Issue: Clear description of vulnerability
- Fix: Specific code suggestion to remediate

Report format: Group by severity, most critical first.
