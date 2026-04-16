---
phase: 26-readme-and-onboarding-polish
verified: 2026-04-16T13:15:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "No Steps 2-9 wizard walkthrough text anywhere in the README"
    status: failed
    reason: "Dangling references to removed wizard steps remain in 'After Setup' and Troubleshooting sections. Step 8 was removed from the Install section but is still referenced in the 'After Setup — Set Up Email Forwarding' section."
    artifacts:
      - path: "README.md"
        issue: "Line 126 references 'Step 8' which no longer exists in the main Install section. Also, Troubleshooting section (lines 236-239) contains references to 'Step 3' and 'Step 2' which were part of the wizard walkthrough that was supposed to be removed."
    missing:
      - "Update line 126 from 'Pipedream inbound address you entered in Step 8' to reference the wizard step without a number (e.g., 'Pipedream inbound address you configured during setup')"
      - "Review and update Troubleshooting section headings and body text that reference specific wizard step numbers (Step 3, Step 2) since those numbered steps no longer exist in the main Install section"
---

# Phase 26: README and Onboarding Polish Verification Report

**Phase Goal:** A non-programmer evaluating self-hosting reads a README that immediately explains the problem being solved, clicks Deploy and lands in a new tab, then follows three concise install steps — deploy, find URL, set password — with the wizard handling everything after that.

**Verified:** 2026-04-16T13:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "First paragraph explains the YNAB-multi-category-payee problem specifically (not generic 'creates transactions from emails')" | ✓ VERIFIED | Lines 3-11: Clear explanation of YNAB payee-categorization limitation and Amazon multi-category example |
| 2 | "Deploy button opens Railway in a new tab" | ✓ VERIFIED | Line 54: `<a href="https://railway.com/template/bIms_s" target="_blank"><img src="https://railway.app/button.svg" alt="Deploy on Railway"></a>` |
| 3 | "Install section has exactly three steps: deploy, find URL, open and set password" | ✓ VERIFIED | Lines 107-121: Step 1 (Deploy to Railway), Step 2 (Find your app URL), Step 3 (Open the app and set up) |
| 4 | "No Steps 2-9 wizard walkthrough text anywhere in the README" | ✗ FAILED | Line 126 references "Step 8"; Troubleshooting section (lines 236-239) references "Step 3" and "Step 2" — dangling references to removed wizard steps |
| 5 | "Domain discovery instruction says the URL is auto-generated and tells the user where Railway shows it" | ✓ VERIFIED | Lines 113-115: "The public URL is shown at the top of the service page (it looks like `https://something.up.railway.app`). You can also find it under **Settings → Networking**." |

**Score:** 4/5 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `README.md` | Updated README with problem statement, simplified install, and corrected deploy button | ⚠️ PARTIAL | Deploy button correctly uses `target="_blank"`. Problem statement is correct. Install reduced to 3 steps. However, dangling references to removed wizard steps remain in the file. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| README.md opening paragraph | YNAB multi-category-payee problem | Specific description matching pattern `YNAB.*payee\|payee.*YNAB\|Amazon.*categor` | ✓ WIRED | Lines 3-7 contain "YNAB automatically categorizes transactions by payee" and "shop at a place like Amazon, where one order might be groceries, another electronics, and another home supplies" |
| Deploy button | Railway template | HTML anchor with `target="_blank"` | ✓ WIRED | Line 54: `<a href="https://railway.com/template/bIms_s" target="_blank">` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| README-01 | 26-01-PLAN | README opening explains the specific problem: YNAB auto-categorizes by payee, but multi-category payees (e.g. Amazon) require manually cross-referencing email receipts | ✓ SATISFIED | Lines 3-11: Problem clearly explained with Amazon example |
| README-02 | 26-01-PLAN | Deploy button opens in a new browser tab (target="_blank") | ✓ SATISFIED | Line 54: HTML anchor with `target="_blank"` |
| README-03 | 26-01-PLAN | Install section covers only: click deploy → wait for green check → find your URL → open it → set password (wizard handles the rest) | ✓ SATISFIED | Lines 107-121: Three steps as specified |
| README-04 | 26-01-PLAN | Remove verbose per-step wizard instructions (Steps 2-9) — wizard UI is self-explanatory | ✗ BLOCKED | Old wizard steps have been removed from the Install section headings, but references to them remain in body text (line 126: "Step 8", Troubleshooting: "Step 3", "Step 2") |
| README-05 | 26-01-PLAN | Simplify domain discovery instruction — domain is auto-generated, user just needs to know where Railway shows it | ✓ SATISFIED | Lines 113-115: Clear explanation of where to find the auto-generated URL in Railway |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| README.md | 126 | Dangling reference to removed wizard step ("Step 8") | ⚠️ Warning | Creates confusion: user reads "Step 8" but Install section only has Steps 1-3. Reader must infer this refers to wizard setup. |
| README.md | 236 | Troubleshooting heading references "Step 3" | ⚠️ Warning | Inconsistent with the new 3-step Install structure. Might confuse users who expect "Step 3" to be "Open the app and set up". |
| README.md | 238-239 | Troubleshooting body references "Step 2" | ⚠️ Warning | Similar confusion: the new "Step 2" is "Find your app URL", not "YNAB Personal Access Token setup" |

### Human Verification Required

None required beyond fixing the identified gaps.

### Gaps Summary

The phase successfully achieved 4 out of 5 core truths. The Deploy button correctly opens in a new tab, the problem statement clearly explains the YNAB payee-categorization issue, and the Install section is properly simplified to three steps.

However, **Truth 4 failed**: The requirement "No Steps 2-9 wizard walkthrough text anywhere in the README" is violated by dangling references to removed wizard steps:

1. **Line 126** in the "After Setup — Set Up Email Forwarding" section references "Step 8" (the Pipedream configuration step that was removed from the Install section). This should be reworded to not reference a specific step number since the wizard sequence was restructured.

2. **Lines 236-239** in the Troubleshooting section contain references to "Step 3" and "Step 2" which were part of the old 9-step wizard walkthrough that was removed. The Troubleshooting section appears to have been left unchanged when the wizard steps were removed from the Install section, creating orphaned references.

**Root cause**: The commit 18531c4 removed the old wizard step headings and documentation from the Install section but did not update all references to those steps throughout the document. The PLAN's success criteria specified "No Steps 2-9 wizard walkthrough text anywhere in the file", which this partially violates.

**Remediation**: Either:
- Update all remaining references to step numbers to use generic language (e.g., "during setup" instead of "in Step 8")
- Or update the Troubleshooting section headings to not reference specific step numbers (rename "The budget dropdown at Step 3 shows..." to something more descriptive)

---

_Verified: 2026-04-16T13:15:00Z_
_Verifier: Claude (gsd-verifier)_
