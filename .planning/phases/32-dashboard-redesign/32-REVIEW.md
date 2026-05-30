---
phase: 32-dashboard-redesign
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/tool-run-queries.ts
  - src/lib/tool-run-queries.test.ts
  - src/app/api/dashboard/currency-status/route.ts
  - src/lib/activity-log-queries.ts
  - src/lib/activity-log-queries.test.ts
  - src/app/api/tools/fix-eur-transfers/route.ts
  - src/app/api/tools/reconcile-eur-wise/route.ts
  - src/app/(dashboard)/dashboard/CurrencyPanel.tsx
  - src/app/(dashboard)/dashboard/page.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase adds a redesigned dashboard with an Email Automation panel, a Currency panel showing last-run status for three financial tools, and a Forwarding Address card. The implementation is generally clean. One critical bug exists in `CurrencyPanel.tsx` where a silently-swallowed fetch error leaves the component in a permanently broken state with no user feedback. Four warnings cover input-validation gaps, a logic bug in "start of week" calculation, and a missing error-status branch in `LAST_RUN_TRANSFER_FIX` handling. Two info items cover a missing `eurConversion` test and the 5-second polling interval.

---

## Critical Issues

### CR-01: Silent fetch failure in CurrencyPanel leaves panel broken with no feedback

**File:** `src/app/(dashboard)/dashboard/CurrencyPanel.tsx:78-79`

**Issue:** The `catch` block in `fetchStatus` is completely empty (`.catch(() => {})`). If the `/api/dashboard/currency-status` request fails — network error, 401 after session expiry, 500 — `data` stays `null` forever and the panel renders all three rows as "Never run" without any error indicator. The polling continues silently every 5 seconds. The user cannot distinguish "genuinely never run" from "fetch is broken."

**Fix:**
```tsx
const [data, setData] = useState<LastToolRuns | null>(null)
const [error, setError] = useState(false)

function fetchStatus() {
  fetch('/api/dashboard/currency-status')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((d: LastToolRuns) => { setData(d); setError(false) })
    .catch(() => setError(true))
}

// In render:
{error && (
  <div style={{ fontSize: '0.8125rem', color: '#991b1b' }}>
    Unable to load status
  </div>
)}
```

---

## Warnings

### WR-01: `getActivityLogs` accepts unvalidated user-controlled date strings passed to `new Date()`

**File:** `src/lib/activity-log-queries.ts:65-66`

**Issue:** `params.from` and `params.to` are passed directly to `new Date(from)` and `new Date(to + 'T23:59:59')` without any format validation. `new Date('anything')` produces `Invalid Date` — Prisma will then throw an opaque error. The strings come from query parameters in the calling routes, so this is user-controlled input. Concretely, `new Date('foo')` is `NaN`, and `{ gte: NaN }` will cause a Prisma validation error that bubbles up as an unhandled 500.

**Fix:**
```ts
if (params.from) {
  const d = new Date(params.from)
  if (isNaN(d.getTime())) throw new Error('Invalid from date')
  receivedAt.gte = d
}
if (params.to) {
  const d = new Date(params.to + 'T23:59:59')
  if (isNaN(d.getTime())) throw new Error('Invalid to date')
  receivedAt.lte = d
}
```

---

### WR-02: "Start of week" calculation uses `getDay()` (Sunday=0), producing wrong week boundary in non-Sunday locales

**File:** `src/lib/activity-log-queries.ts:17-19`

**Issue:** `startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())` treats Sunday as the first day of the week (JS `getDay()` returns 0 for Sunday). On a Monday, this rolls back to the *previous* Sunday, which can include logs from last week. On a Sunday, it stays on the current day. For a European user (ISO week starts Monday) this produces a "this week" window that is frequently one day wider than expected and spans two calendar weeks.

The stat is cosmetic so this is a Warning rather than Critical, but it silently produces incorrect counts every day except Sunday.

**Fix:**
```ts
// ISO week: Monday = day 1
const day = startOfWeek.getDay() || 7   // convert Sunday 0 → 7
startOfWeek.setDate(startOfWeek.getDate() - (day - 1))
startOfWeek.setHours(0, 0, 0, 0)
```

---

### WR-03: `fix-eur-transfers` POST does not persist an `error` status when `applyTransferFix` throws

**File:** `src/app/api/tools/fix-eur-transfers/route.ts:66-69`

**Issue:** The outer `catch` block returns a 500 JSON response but never calls `saveSettings`. This means `LAST_RUN_TRANSFER_FIX` is never updated when the tool run fails with an exception — the setting retains its previous value, so the dashboard's "Currency" panel shows the last *successful* run timestamp, misleading the operator into thinking the tool is healthy when it actually crashed.

The `reconcile-eur-wise` route (line 47-49) has the same gap.

**Fix:**
```ts
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  // persist failure so dashboard reflects the error
  await saveSettings({
    LAST_RUN_TRANSFER_FIX: JSON.stringify({
      runAt: new Date().toISOString(),
      status: 'error',
      pairsFixed: 0,
    }),
  }).catch(() => {});   // best-effort — don't mask original error
  return NextResponse.json({ error: message }, { status: 500 });
}
```

Apply the same pattern to `reconcile-eur-wise/route.ts` lines 47-49.

---

### WR-04: `CurrencyPanel` does not check HTTP response status before calling `.json()`

**File:** `src/app/(dashboard)/dashboard/CurrencyPanel.tsx:77-78`

**Issue:** `.then(r => r.json())` is called unconditionally, regardless of whether `r.ok` is true. A 401 or 500 response body may or may not be valid JSON matching `LastToolRuns`. If the server returns `{ error: 'Unauthorized' }`, it will be cast to `LastToolRuns` and `setData` will be called with an object whose `transferFix`, `eurConversion`, and `reconciliation` fields are all `undefined`. The `data?.transferFix ?? null` guards in the JSX handle the undefined gracefully (rendering "Never run"), but this hides session expiry from the user entirely.

This overlaps with CR-01 — the fix there (checking `r.ok` before `.json()`) resolves both.

---

## Info

### IN-01: No test coverage for `LAST_RUN_EUR_CONVERSION` key parsing

**File:** `src/lib/tool-run-queries.test.ts`

**Issue:** There is a test that asserts `eurConversion` is null when the setting is absent (line 52-58) but no test exercises the path where `LAST_RUN_EUR_CONVERSION` is actually set and parsed. This is the only `LastToolRuns` key with zero positive-path coverage.

**Fix:** Add a test mirroring the `LAST_RUN_TRANSFER_FIX` test at line 22 but keyed on `LAST_RUN_EUR_CONVERSION` with a `converted` field.

---

### IN-02: 5-second polling interval is hard-coded with no comment justifying the choice

**File:** `src/app/(dashboard)/dashboard/CurrencyPanel.tsx:83`

**Issue:** `setInterval(fetchStatus, 5000)` is a magic number. Tool runs are infrequent (manual or cron-triggered). A 5-second poll generates 12 `/api/dashboard/currency-status` requests per minute per open browser tab, hitting the database on every tick. This is not a correctness bug, but the value should at minimum be a named constant with a rationale comment, and a longer interval (30s–60s) would be more appropriate for the use case.

**Fix:**
```ts
/** Poll every 30s — tool runs are infrequent; daily or manual triggers only */
const POLL_INTERVAL_MS = 30_000
// ...
const id = setInterval(fetchStatus, POLL_INTERVAL_MS)
```

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
