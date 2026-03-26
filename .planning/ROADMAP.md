# Amazon to YNAB Automation — Roadmap

## Shipped Milestones

- **v1.0** — Core pipeline: Pipedream → Claude → YNAB for Amazon emails, with dedup, sender routing, and error notifications (2026-03-24)
- **v2.0** — Any retailer + category tagging: Amazon filter removed, dynamic retailer payee, Euro routing, optional category hint from email (2026-03-25) → [archive](.planning/milestones/v2.0-ROADMAP.md)

## Current Milestone: v3.0 — Generic & Publishable

**Goal:** Make the automation usable by anyone, not just Manuel and Emily-Kate. All personal references removed; sender routing driven by JSON config; published as open-source.

| Phase | Goal | Status |
|-------|------|--------|
| 7. Config-driven routing | Replace hardcoded sender map with SENDERS JSON env var; remove all personal references from code and tests | Not started |
| 8. Publishing readiness | Rewrite README as setup guide; migrate Railway to new env vars; make repo public | Not started |
