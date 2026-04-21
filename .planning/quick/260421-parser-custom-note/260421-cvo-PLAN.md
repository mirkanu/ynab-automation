---
id: 260421-cvo
type: quick
slug: parser-custom-note
date: 2026-04-21
description: Parser AI extracts optional custom note from top of forwarded email body, composed into memo
---

# Quick Task 260421-cvo: Parser custom-note extraction

## Goal
When user adds a brief comment at the very top of a forwarded email body, the parser AI extracts it and the YNAB memo becomes `"{sender}: {description} - {custom note}"` instead of `"{sender}: {description} - Automatically added from email"`.

## Tasks

### 1. Extract `customNote` in parser
**Files:** `src/lib/claude.ts`, `src/lib/claude.test.ts`
- Add optional `customNote?: string` to `ParsedOrder`
- Update prompt: instruct Claude to extract any short free-text note appearing at the very top of the email body (above the forwarded content). Return empty string if none.
- Validate + pass through; empty string → undefined
- Add test: email with top-of-body note → returns `customNote`
- Add test: email without note → `customNote` absent/undefined

### 2. Centralize memo formatting
**Files:** `src/lib/ynab.ts`, `src/lib/ynab.test.ts`
- Add `formatMemo(senderName, description, customNote?)` export
  - With note: `"{sender}: {description} - {note}"`
  - Without: `"{sender}: {description} - Automatically added from email"`
- Add `customNote?: string` to `YnabTransactionParams`; use `formatMemo` in `createYnabTransaction`
- Add/update tests for both shapes

### 3. Wire through call sites
**Files:** `src/app/api/webhook/route.ts`, `src/app/api/replay/route.ts`, `src/app/(dashboard)/tools/TestParseForm.tsx`
- Replace inline memo string with `formatMemo(...)` + pass `customNote` from `parsed.customNote`
- Pass `customNote` into `createYnabTransaction`
- Update TestParseForm preview to reflect the note when present

## Verify
- `npm run typecheck` clean
- `npm run test -- claude ynab` passes
