# Welcome to Fiskix

## How We Use Claude

Based on usage over the last 30 days:

Work Type Breakdown:
  Build Feature     ██████████░░░░░░░░░░  50%
  Improve Quality   ██████░░░░░░░░░░░░░░  30%
  Debug Fix         ███░░░░░░░░░░░░░░░░░  15%
  Plan Design       █░░░░░░░░░░░░░░░░░░░   5%

Top Skills & Commands:
  /security-review                       ████████████████████  2x/month
  /mcp__github__issue_to_fix_workflow    ████████████████████  2x/month
  /model                                 ████████████████████  2x/month
  /review                                ██████████░░░░░░░░░░  1x/month

Top MCP Servers:
  Vercel    ████████████████████  12 calls
  GitHub    ███░░░░░░░░░░░░░░░░░   2 calls

## Your Setup Checklist

### Codebases
- [ ] fiskix — https://github.com/hamiltonmoreno/fiskix

### MCP Servers to Activate
- [ ] Vercel — deploy previews, runtime logs, deployment status, project lookup. Sign in at vercel.com and connect via the Vercel MCP server.
- [ ] GitHub — PR/issue management, code search, branch protection. Authenticate via `gh auth login` or the GitHub MCP server's OAuth flow.
- [ ] Supabase — project `rqplobwsdbceuqhjywgt` (eu-west-1). Database, auth, storage, edge functions. Get the service role key from the Supabase dashboard and add to `.env.local`.

### Skills to Know About
- `/security-review` — runs a structured security audit on the current diff. The team uses it before merging anything that touches auth, RLS, edge functions, or user input.
- `/review` — code review of an open PR (or the current branch vs main). Used as a final gate before merge.
- `/mcp__github__issue_to_fix_workflow` — picks up a GitHub issue and walks it through diagnosis → fix → PR. Good for triaging the backlog.
- `/model` — switch between Opus / Sonnet / Haiku. The team defaults to Opus for feature work and security reviews.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
