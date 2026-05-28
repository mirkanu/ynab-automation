# YNAB Automation — Codebase Orientation

YNAB automation service: syncs bank transactions, handles email-based expense capture,
and provides budget reporting. Next.js API + PostgreSQL.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database | PostgreSQL 16 |
| Email inbound | Resend inbound webhook |
| Budget API | YNAB Personal Access Token |
| Auth | Auth.js (iron-session) |

## Deployment

Migrated from Railway to Hetzner VPS on 2026-04-25. Fully self-hosted.

| | |
|---|---|
| **Host** | Hetzner VPS — `hetzner-vps` (37.27.212.18) |
| **App container** | `ynab-api`, port 3001 on host |
| **Database** | `ynab-db` PostgreSQL container |
| **Compose file** | `/home/services/hetzner-vps/docker-compose.yml` |
| **Auto-deploy** | Claude deploys directly via SSH after each change (no GitHub Actions) |
| **Railway** | No longer used |
| **SSH key** | `~/.ssh/hetzner_claude` — `claude` user on both machines |

### Deploy command

```bash
ssh hetzner-vps "set -eux && git -C /home/services/ynab fetch origin master && git -C /home/services/ynab checkout origin/master -- . && cd /home/services/hetzner-vps && docker compose --env-file /home/services/.env.production up --build -d ynab-api"
# Then health check:
ssh hetzner-vps "sleep 10 && curl -sf http://localhost:3001/api/webhook"
```

Note: `RAILWAY_API_TOKEN` appears in the compose env vars — verify whether it is still
referenced in application code. If not, remove it from the compose file.

## GSD Tools

Planning files in `.planning/`. GSD tools at `/data/home/.claude/get-shit-done/bin/gsd-tools.cjs`.

## Verbosity Contract

These rules apply to every terminal session in this project. They reduce what Claude says in the terminal so the tmux pane stays readable.

1. **Skip CONTEXT.md interrogation when CONTEXT.md already exists.** If `.planning/phases/{phase}/{phase}-CONTEXT.md` is present, do not re-interview the user about the phase — proceed directly to planning.
2. **Name the phase in plain English in the first line of the session report.** Instead of "I will now begin Phase 3", write "Starting YNAB email automation work." One line, present tense, specific.
3. **Don't repeat what the user just said.** If the user said "plan phase 3", do not echo back "You asked me to plan phase 3." Begin the work.
4. **Prefer one-line status updates.** Instead of a paragraph explaining what you are about to do, emit a single line: "Reading roadmap." "Writing plan 01." "Done." Reserve multi-line output for actual results (lists of tasks, file paths, errors).
5. **Active voice, present tense.** Write "Creating handler.ts" not "handler.ts will be created" and not "I am in the process of creating handler.ts".

<!-- GSD:non-programmer-contract-start source:templates/claude-md.md -->
## Non-Programmer Contract

Claude must never ask the user to perform a programmer action that Claude can do itself. Technical decisions are made by Claude using its own judgment, documented in the session report, and reversible by the user in plain English.

| Forbidden | Replacement |
|-----------|-------------|
| Asking user to open/view/read code | Read it yourself; summarise findings in plain English |
| Asking user to paste git diffs or logs | Read them yourself with `git diff`, `git log`, or file reads |
| Asking user to edit a config/.env/any file | Edit it yourself; use the Global Env Editor (Dashboard) if credentials are missing |
| Asking user to run a terminal command | Run it yourself |
| "Deploy started, check back in a few minutes" | Run the deploy, wait for it, verify it's live, then ping the user |
| Asking user to run the tests | Run them yourself; only report after they pass (or after a real failure needing a decision) |
| Asking user a technical architecture decision in jargon | Decide yourself; state the decision in plain English; offer to change course |
| Asking user to review code before commit | Commit yourself after verify-work passes |
| "You'll need to do X manually after this finishes" | Don't finish until X is done, or add X to the plan |
| "I'll leave this for you to configure" | Configure with a sensible default; document in the session report |
| Technical disambiguation questions mid-plan | Use CLAUDE.md defaults; only escalate if truly stuck, framed in plain English |
| Asking user to paste an API key in the terminal | Use the Global Env Editor panel (Dashboard) |
<!-- GSD:non-programmer-contract-end -->
