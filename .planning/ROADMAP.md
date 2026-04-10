# Amazon to YNAB Automation — Roadmap

## Milestones

- ✅ **v1.0** — Core pipeline: Pipedream → Claude → YNAB (2026-03-24)
- ✅ **v2.0** — Any retailer + category tagging (2026-03-25) → [archive](.planning/milestones/v2.0-ROADMAP.md)
- ✅ **v3.0** — Generic & publishable + setup wizard (2026-03-26) → [archive](.planning/milestones/v3.0-ROADMAP.md)
- ✅ **v4.0** — Admin Backend UI (2026-03-28) → [archive](.planning/milestones/v4.0-ROADMAP.md)
- ✅ **v5.0** — Multi-Tenant SaaS (2026-04-10) → [archive](.planning/milestones/v5.0-ROADMAP.md)
- 📋 **Next** — Single-Tenant Rollback (planned)

## Phases

<details>
<summary>✅ v1.0 / v2.0 / v3.0 (Phases 1-9) - SHIPPED 2026-03-26</summary>

Phases 1-9 covered core pipeline, any-retailer support, category tagging, config-driven routing, and the interactive setup wizard. See archived roadmaps for detail.

</details>

<details>
<summary>✅ v4.0 Admin Backend UI (Phases 10-15) - SHIPPED 2026-03-28</summary>

- [x] Phase 10: Deployment Retirement (1/1 plans) — completed 2026-03-26
- [x] Phase 11: Admin Authentication (1/1 plans) — completed 2026-03-26
- [x] Phase 12: Activity Log Infrastructure (1/1 plans) — completed 2026-03-27
- [x] Phase 13: Admin UI Shell + Dashboard + Log Viewer (2/2 plans) — completed 2026-03-27
- [x] Phase 14: Settings Editor (1/1 plans) — completed 2026-03-28
- [x] Phase 15: Test & Replay Tools (1/1 plans) — completed 2026-03-28

</details>

<details>
<summary>✅ v5.0 Multi-Tenant SaaS (Phases 16-19) - SHIPPED 2026-04-10</summary>

- [x] Phase 16: User Accounts & Multi-Tenant Foundation (4/4 plans) — completed 2026-03-29
- [x] Phase 17: YNAB OAuth & Token Management (6/6 plans) — completed 2026-03-30
- [x] Phase 18: Per-User Inbound Email (5/5 plans) — completed 2026-03-30
- [x] Phase 19: Dashboard, Onboarding & Account Management (5/5 plans) — completed 2026-03-30

Bugs discovered post-facto during UAT (2026-04-10) and fixed:
- Middleware signin callbackUrl pointed to `localhost:8080` behind Railway's proxy (commit 80ee088)
- Test mode toggle was not wired into the active Pipedream webhook handler (commit f92e34c)

</details>

### 📋 Next Milestone: Single-Tenant Rollback (Planned)

Scope to be defined via `/gsd:new-milestone`. Goal: walk back from the multi-tenant architecture introduced in v5.0 to a simpler single-tenant deployment better suited to the actual usage pattern.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Deployment Retirement | v4.0 | 1/1 | Complete | 2026-03-26 |
| 11. Admin Authentication | v4.0 | 1/1 | Complete | 2026-03-26 |
| 12. Activity Log Infrastructure | v4.0 | 1/1 | Complete | 2026-03-27 |
| 13. Admin UI Shell + Dashboard + Log Viewer | v4.0 | 2/2 | Complete | 2026-03-27 |
| 14. Settings Editor | v4.0 | 1/1 | Complete | 2026-03-28 |
| 15. Test & Replay Tools | v4.0 | 1/1 | Complete | 2026-03-28 |
| 16. User Accounts & Multi-Tenant Foundation | v5.0 | 4/4 | Complete | 2026-03-29 |
| 17. YNAB OAuth & Token Management | v5.0 | 6/6 | Complete | 2026-03-30 |
| 18. Per-User Inbound Email | v5.0 | 5/5 | Complete | 2026-03-30 |
| 19. Dashboard, Onboarding & Account Management | v5.0 | 5/5 | Complete | 2026-03-30 |
