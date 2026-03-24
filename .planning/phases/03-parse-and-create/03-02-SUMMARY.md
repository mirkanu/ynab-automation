---
phase: 03-parse-and-create
plan: "02"
subsystem: lib
tags: [claude-api, ynab-api, parsing, transactions, tdd]
dependency_graph:
  requires: [03-01]
  provides: [parseAmazonEmail, createYnabTransaction]
  affects: [03-03]
tech_stack:
  added: ["@anthropic-ai/sdk (already in package.json, now used)"]
  patterns: ["vi.hoisted() for cross-boundary mock sharing", "function constructor syntax for vitest class mocks", "vi.stubGlobal for fetch mocking"]
key_files:
  created:
    - src/lib/claude.ts
    - src/lib/claude.test.ts
    - src/lib/ynab.ts
    - src/lib/ynab.test.ts
  modified: []
decisions:
  - "Used vi.hoisted() + function constructor syntax for Anthropic SDK mock — arrow functions cannot be used as constructors in vitest mocks (warning: 'did not use function or class')"
  - "mockCreate must be declared via vi.hoisted() so it is available inside the vi.mock() factory closure after hoisting"
  - "claude.ts instantiates new Anthropic() inside the function body so ANTHROPIC_API_KEY is read at call time (not module load time)"
  - "YNAB error threshold is res.ok (falsy), not strictly res.status !== 201 — covers 200 range future compatibility"
metrics:
  duration: "380s"
  completed: "2026-03-24"
  tasks_completed: 2
  files_created: 4
  tests_added: 18
---

# Phase 03 Plan 02: Claude Parsing & YNAB Client Summary

**One-liner:** Two isolated lib modules — `parseAmazonEmail()` via claude-haiku-4-5 and `createYnabTransaction()` via YNAB REST API — fully tested with mocked dependencies.

## What Was Built

### src/lib/claude.ts

Exports `parseAmazonEmail(html: string, senderName: string): Promise<ParsedOrder | null>`.

- Model: `claude-haiku-4-5` (cost-efficient, max_tokens: 256)
- System prompt instructs JSON-only response; user prompt requests `{ amount, description }` with multi-item summarization ("2 items: X, Y")
- Validates response: must have `amount` (number) and `description` (string)
- Returns `null` on any failure — API errors, malformed JSON, missing fields — never throws

### src/lib/ynab.ts

Exports `createYnabTransaction(params: YnabTransactionParams): Promise<string>`.

- Endpoint: `POST https://api.youneedabudget.com/v1/budgets/{budgetId}/transactions`
- Amount conversion: `Math.round(amount * 1000) * -1` → e.g. 12.99 → -12990 milliunits
- Memo: `${senderName} — ${description}` (em dash U+2014)
- Payee: `"Amazon"`, `category_id: null`, `cleared: "cleared"`, `approved: false`
- Auth: `Bearer ${process.env.YNAB_PERSONAL_ACCESS_TOKEN}`
- Date: today (`new Date().toISOString().split('T')[0]`)
- Throws `Error("YNAB API error: {status}")` on non-2xx response
- Returns `data.data.transaction.id` on success

## Test Coverage

| File | Tests | Strategy |
|------|-------|----------|
| claude.test.ts | 6 | vi.hoisted() + function constructor mock of @anthropic-ai/sdk |
| ynab.test.ts | 12 | vi.stubGlobal('fetch', ...) + vi.unstubAllGlobals() cleanup |
| **Total new** | **18** | No real API calls |
| email.test.ts | 16 | (existing, no regressions) |
| **Grand total** | **34** | All pass |

## Commits

| Hash | Message |
|------|---------|
| 5d38cac | feat(03-02): implement Claude email parsing lib with tests |
| f19b068 | feat(03-02): implement YNAB transaction client with tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest mock factory couldn't access outer-scope vi.fn() references**

- **Found during:** Task 1 (RED → GREEN)
- **Issue:** `vi.mock()` is hoisted to the top of the module before variable declarations run. A `const mockCreate = vi.fn()` declared before `vi.mock()` in source order is `undefined` inside the mock factory closure at runtime.
- **Fix:** Used `vi.hoisted(() => ({ mockCreate: vi.fn() }))` to declare the mock fn in the hoisting phase itself, making it available in the factory.
- **Files modified:** src/lib/claude.test.ts
- **Commits:** 5d38cac (iterative fix included in final commit)

**2. [Rule 1 - Bug] Arrow function constructor causes vitest warning and mock failure**

- **Found during:** Task 1 (GREEN debugging)
- **Issue:** `vi.fn(() => ({ messages: { create: mockCreate } }))` used as a mock constructor produces a vitest warning "did not use 'function' or 'class'". When called via `new`, arrow functions cannot be constructors and the return value is silently dropped, making the Anthropic instance `{}` with no `.messages` property.
- **Fix:** Changed mock factory to use `function MockAnthropic() { return {...}; }` (regular function syntax), which works correctly as a constructor mock.
- **Files modified:** src/lib/claude.test.ts
- **Commits:** 5d38cac (iterative fix included in final commit)

## Self-Check: PASSED

- src/lib/claude.ts — FOUND
- src/lib/claude.test.ts — FOUND
- src/lib/ynab.ts — FOUND
- src/lib/ynab.test.ts — FOUND
- Commit 5d38cac — FOUND
- Commit f19b068 — FOUND
