---
phase: 26-readme-and-onboarding-polish
plan: "01"
subsystem: documentation
tags: [readme, onboarding, install, deploy-button]
dependency_graph:
  requires: []
  provides: [README-01, README-02, README-03, README-04, README-05]
  affects: []
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - README.md
decisions:
  - "Problem statement leads with specific YNAB payee-categorization pain point (Amazon multi-category example) rather than generic one-liner"
  - "Deploy button converted from Markdown image-link to HTML anchor with target='_blank' for new-tab behavior"
  - "Install reduced to 3 steps (deploy, find URL, open app) — wizard handles the rest in-app"
  - "Prerequisites table removed — wizard links to each service at the point of need"
  - "Steps 10/11 renamed to 'After Setup' to avoid numbered confusion with new 3-step install"
metrics:
  duration: "4 minutes"
  completed_date: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 26 Plan 01: README Rewrite — Problem Statement, Deploy Button, and Install Simplification Summary

README.md rewritten with a specific YNAB payee-categorization problem statement (Amazon multi-category example), HTML deploy button with `target="_blank"`, and a three-step install replacing the nine-step wizard walkthrough.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite problem statement opening | 2fe8c9c | README.md |
| 2 | Fix deploy button and simplify Install section | 18531c4 | README.md |

## What Was Built

### Task 1 — Problem Statement

The opening paragraph was replaced with a specific description of the YNAB payee-categorization problem: YNAB categorizes by payee, which breaks down for places like Amazon where a single payee covers many different purchase categories. The paragraph names the pain (manually opening order confirmation emails to categorize transactions) and connects it to the app's solution (automated extraction and transaction creation).

### Task 2 — Deploy Button and Install Section

Three targeted edits to README.md:

1. **Deploy button**: Converted from `[![Deploy on Railway](...)](#)` Markdown syntax to `<a href="..." target="_blank"><img ...></a>` HTML, ensuring the button opens in a new tab.

2. **Install section**: The nine-step wizard walkthrough (Steps 1-9) was removed and replaced with three steps: deploy to Railway, find your app URL (Railway auto-generates it; the step explains where to find it), and open the app (the wizard handles the rest). The Prerequisites table was also removed.

3. **Email forwarding and test email**: Previously Steps 10 and 11, now renamed to "After Setup — Set Up Email Forwarding" and "After Setup — Send a Test Email" to avoid numbering confusion with the new 3-step install.

## Decisions Made

- Problem statement leads with the specific YNAB payee-categorization pain point using Amazon as the concrete example — not a generic description of the feature
- Deploy button uses HTML anchor with `target="_blank"` so users don't lose their Railway session when navigating back
- Install reduces to 3 steps because the wizard is now self-explanatory in-app — no need to document each wizard screen in the README
- Prerequisites table removed — the wizard itself links to each service at the step where it's needed, making the table redundant
- Steps 10/11 renamed to "After Setup" headers so they don't imply a numbered sequence following Steps 1-3

## Deviations from Plan

None — plan executed exactly as written.

## Verification

All success criteria confirmed:

- `grep 'target="_blank"' README.md` — found on deploy button anchor
- `grep -c '^\[\!\[Deploy on Railway\]' README.md` — returns 0 (old-style button gone)
- `grep -i "payee\|Amazon" README.md` — found in opening paragraph
- `grep "### Step [4-9]" README.md` — returns nothing (wizard steps 4-9 removed)
- `grep "### Step" README.md` — shows only Step 1, Step 2, Step 3
- `grep "After Setup" README.md` — shows both After Setup sections
- `grep "## Prerequisites" README.md` — returns nothing (table removed)

## Self-Check: PASSED

- README.md modified with all required changes: confirmed
- Commit 2fe8c9c exists: confirmed (Task 1 — problem statement)
- Commit 18531c4 exists: confirmed (Task 2 — deploy button + install)
