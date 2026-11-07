---
title: MCP Connector — Architecture Decisions
date: 2026-06-18
context: Exploration session before Phase 35 planning
---

## Decision: Python + FastMCP sidecar (not embedded in Next.js)

Same pattern as `justwatch-mcp`. FastMCP is the cleanest MCP SDK available — the TypeScript
ecosystem (GSD Dashboard approach) requires a separate sub-package with its own build step.
The YNAB app is Next.js but the MCP server has no reason to share code with it.

**Deploy:** standalone uvicorn process, separate port, separate PM2 service or Docker container.

## Decision: Call upstream APIs directly

The MCP tools call the YNAB API and Wise API directly using PATs from `.env.production`.
No dependency on the Next.js app being up. Simpler service graph.

**Env vars needed:**
- `YNAB_API_KEY` (already in .env.production as YNAB PAT)
- Wise token (already in .env.production — see reference_wise_key.md in memory)
- Wise profile/balance IDs (already discovered, see same memory note)

## Decision: Cloudflare Access gate (OAuth)

Financial data warrants real auth, not security-by-obscurity. Cloudflare Access supports
OAuth 2.0 — Claude.ai MCP connectors support OAuth-gated servers via the browser OAuth flow.

Setup: Zero Trust → Access → Applications → Self-hosted → point at MCP subdomain → allow
manuelkuhs@gmail.com as the only identity.

## Security: What is NOT exposed

Deliberately excluded tools:
- No Wise account detail endpoint (would return IBANs)
- No YNAB account number fields (YNAB doesn't surface these anyway)
- No raw import IDs (can contain bank reference fragments)

What IS returned: transaction amounts, category names, payee names, dates, balances by currency.
No personally identifying banking credentials.

## v1 Tool Set

| Tool | API | Returns |
|---|---|---|
| `get_budget_summary` | YNAB | Current month: categories with budgeted/spent/available |
| `get_transactions` | YNAB | Transactions filtered by date range and/or category |
| `get_accounts` | YNAB | Account list with cleared balance |
| `get_wise_balances` | Wise | Current balances across all currencies |

## Subdomain suggestion

`ynab-mcp.gsdlabs.dev` — add ingress to Cloudflare Tunnel config, then gate with Access.
