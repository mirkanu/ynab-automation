---
phase: 25-self-host-polish
plan: "01"
subsystem: docs
tags: [legal, readme, license, disclosure]
dependency_graph:
  requires: []
  provides: [LEGAL-01, LEGAL-02]
  affects: [README.md, LICENSE]
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - LICENSE
  modified:
    - README.md
decisions:
  - "LICENSE file created from scratch (did not exist in repo) — MIT text with NOTICE preamble prepended"
  - "No-warranty paragraph placed as blockquote between pitch and Deploy button (lines 7-11), satisfying the above-the-fold requirement"
  - "AI-generated disclosure placed immediately after no-warranty paragraph (lines 13-17) as adjacent blockquote"
  - "Heads-up Deploy button note removed — both legal paragraphs carry the honesty framing; 25-04 will provide the real template URL"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_changed: 2
---

# Phase 25 Plan 01: Legal Disclosures (README + LICENSE) Summary

**One-liner:** Plain-language no-warranty and AI-generated paragraphs inserted above the Deploy button in README.md; LICENSE created with MIT text plus a leading NOTICE preamble.

## What Was Built

Two legal disclosure sections added to the top of README.md (between the pitch line and the Deploy button), and a new LICENSE file created with a NOTICE preamble block prepended to standard MIT license text.

### No-Warranty Paragraph (README.md, lines 7–11)

Blockquote headed "No warranty." States that this is a personal side project provided as-is, with no warranty or support, that the user is responsible for any financial consequences, and references the MIT license for formal terms. Ends with "Nothing on this page is financial advice."

### AI-Generated Disclosure (README.md, lines 13–17)

Blockquote headed "AI-generated." States that every line of code, every test, and every line of this README was written by Claude under human direction, that no human wrote code by hand, and advises the reader to evaluate whether this matches their risk tolerance before running the app against real money.

### LICENSE File (created)

New file with a NOTICE preamble (AI-generated disclosure + no-warranty framing + "nothing here is financial advice"), a visual separator, and then the standard MIT license text. The README footer reference to `LICENSE` was already present and is unchanged.

## Verification

```
grep -c "No warranty" README.md     → 1  (PASS)
grep -c "AI-generated" README.md    → 1  (PASS)
grep -c "personal side project" README.md → 1 (PASS)
grep -c "Claude (Anthropic" README.md → 1 (PASS)
grep -n "No warranty" README.md     → line 7   (PASS — above Deploy button at line 19)
grep -c "AI-Generated" LICENSE      → 1  (PASS)
grep -c "Permission is hereby granted" LICENSE → 1 (PASS — MIT text intact)
npm test                            → 117/117 passed (PASS)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 — README legal paragraphs | 84c51b9 | docs(25-01): add no-warranty and AI-generated disclosures to README |
| 2 — LICENSE file | 2b28b15 | docs(25-01): create LICENSE file with NOTICE preamble + MIT license text |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing file] LICENSE file did not exist**
- **Found during:** Task 2
- **Issue:** The plan and CONTEXT.md both reference modifying an existing LICENSE file, but the repo had no LICENSE file at all.
- **Fix:** Created LICENSE from scratch with a standard MIT license text (copyright 2026 Manuel) plus the required NOTICE preamble. The README already referenced `LICENSE` at the bottom of the file, so creating it satisfies that existing link.
- **Files modified:** LICENSE (created)
- **Commit:** 2b28b15

No other deviations — README edit executed exactly as planned.

## Self-Check: PASSED

- `README.md` exists and contains both required paragraphs above the Deploy button
- `LICENSE` exists and contains the NOTICE preamble plus "Permission is hereby granted"
- Commits 84c51b9 and 2b28b15 verified in git log
- All 117 tests pass
