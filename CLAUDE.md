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
| **Host** | Self-hosted VPS |
| **App container** | `ynab-api`, port 3001 on host |
| **Database** | `ynab-db` PostgreSQL container |
| **Compose file** | Docker Compose (see hetzner-vps repo) |
| **Auto-deploy** | Claude deploys directly via SSH after each change (no GitHub Actions) |
| **Railway** | No longer used |

### Deploy command

```bash
ssh your-vps "git -C /path/to/ynab fetch origin master && git -C /path/to/ynab checkout origin/master -- . && docker compose up --build -d ynab-api"
# Then health check:
ssh your-vps "sleep 10 && curl -sf http://localhost:3001/api/webhook"
```

Note: `RAILWAY_API_TOKEN` appears in the compose env vars — verify whether it is still
referenced in application code. If not, remove it from the compose file.

## GSD Tools

Planning files in `.planning/`. GSD tools at `/data/home/.claude/get-shit-done/bin/gsd-tools.cjs`.
