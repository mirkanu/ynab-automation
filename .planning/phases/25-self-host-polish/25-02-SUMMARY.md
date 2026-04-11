---
phase: 25-self-host-polish
plan: "02"
subsystem: infra
tags: [license-checker, license-audit, legal, compliance, MIT, Apache-2.0, copyleft]

# Dependency graph
requires: []
provides:
  - "docs/LICENSE-AUDIT.md — full per-package runtime license table (81 packages) with copyleft verification"
  - "license-checker devDep for reproducible future audits"
affects: []

# Tech tracking
tech-stack:
  added: ["license-checker@25.0.1 (devDep)"]
  patterns:
    - "npx license-checker --production --json/--summary for runtime-only license enumeration"

key-files:
  created:
    - "docs/LICENSE-AUDIT.md"
  modified:
    - "package.json (license-checker devDep added)"
    - "package-lock.json"

key-decisions:
  - "license-checker --production flag restricts scan to runtime deps only, excluding devDependencies"
  - "caniuse-lite CC-BY-4.0 is non-copyleft data license — explicitly cleared in audit"
  - "Apache-2.0/BSD-3 attribution satisfied by node_modules LICENSE files in self-hosted source deployment (no separate NOTICE file needed)"
  - "ynab-amazon-automation UNLICENSED entry is the project itself appearing in its own scan — not a third-party concern; addressed by 25-01 MIT LICENSE file"

patterns-established:
  - "Run npx license-checker --production --json from project root to reproduce audit"

requirements-completed: [LEGAL-03]

# Metrics
duration: 5min
completed: 2026-04-11
---

# Phase 25 Plan 02: License Audit Summary

**81-package runtime license scan via license-checker confirming zero copyleft, with Apache-2.0/BSD-3/CC-BY-4.0 attribution explicitly addressed**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T20:33:58Z
- **Completed:** 2026-04-11T20:39:11Z
- **Tasks:** 1
- **Files modified:** 3 (docs/LICENSE-AUDIT.md created, package.json + package-lock.json updated)

## Accomplishments

- Installed `license-checker@25.0.1` as devDep enabling reproducible future audits
- Created `docs/LICENSE-AUDIT.md` covering all 81 runtime packages (7 direct + 74 transitive)
- Confirmed zero copyleft licenses (GPL/LGPL/AGPL/MPL/CDDL/EPL/SSPL/CC-BY-SA) in the runtime tree
- Documented attribution requirements for 9 Apache-2.0, 1 BSD-3-Clause, 1 BSD-2-Clause, and 1 CC-BY-4.0 package
- Cleared `caniuse-lite` CC-BY-4.0 (data license, not copyleft) and noted self-hosted deployment satisfies Apache-2.0 NOTICE requirements via node_modules

## Task Commits

1. **Task 1: Run license-checker and generate docs/LICENSE-AUDIT.md** - `0e113bb` (feat)

**Plan metadata:** (included in task commit above)

## Files Created/Modified

- `docs/LICENSE-AUDIT.md` — 215-line audit with intro, per-package table, copyleft grep result, attribution notes, timestamp
- `package.json` — license-checker added to devDependencies
- `package-lock.json` — lockfile updated

## Decisions Made

- Apache-2.0 NOTICE requirement: self-hosted source deployment via Railway preserves node_modules with all LICENSE files, satisfying attribution without a separate project-root NOTICE file
- CC-BY-4.0 (caniuse-lite): Creative Commons Attribution 4.0 is explicitly non-copyleft — documented and cleared
- Project's own UNLICENSED entry in license-checker output is not a third-party concern; 25-01 adds the MIT LICENSE file resolving this

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- LEGAL-03 satisfied: `docs/LICENSE-AUDIT.md` committed and visible in repo
- Any reviewer can verify zero copyleft without running npm tooling
- Parallel with 25-01 (README legal amendments) — no file conflicts occurred
- Ready for 25-03 (screenshots + README Features section)

---

## Self-Check: PASSED

- `docs/LICENSE-AUDIT.md` — FOUND
- commit `0e113bb` — FOUND

---

*Phase: 25-self-host-polish*
*Completed: 2026-04-11*
