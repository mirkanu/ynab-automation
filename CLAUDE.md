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
