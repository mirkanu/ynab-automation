---
id: 260421-cvo
type: quick
slug: parser-custom-note
status: complete
date: 2026-04-21
---

# Quick Task 260421-cvo: Parser custom-note extraction — Summary

## Outcome
Parser AI now extracts an optional `customNote` from the very top of forwarded email bodies. When present, the YNAB memo becomes `"{sender}: {description} - {customNote}"` instead of the default `"... - Automatically added from email"` suffix.

## Changes

**Parser (`src/lib/claude.ts`)**
- Added `customNote?: string` to `ParsedOrder`
- Extended Claude prompt with explicit instructions to extract a free-text comment above the forwarded separator / quoted block / `From:` header; return `""` when absent and not to invent one
- Normalize empty/whitespace note → `customNote` omitted

**Memo formatter (`src/lib/ynab.ts`)**
- New `formatMemo(senderName, description, customNote?)` export — single source of truth
- `YnabTransactionParams.customNote?` added; `createYnabTransaction` delegates to `formatMemo`

**Call sites**
- `src/app/api/webhook/route.ts`, `src/app/api/replay/route.ts`: use `formatMemo` + pass `parsed.customNote` into `createYnabTransaction`
- `src/app/(dashboard)/tools/TestParseForm.tsx`: memo preview reflects note when set

**Tests**
- `claude.test.ts`: 3 new cases (note present / empty / missing)
- `ynab.test.ts`: 2 new cases (note suffix / whitespace fallback)
- `webhook/route.test.ts`: mock updated to export `formatMemo`
- All 122 tests pass; `tsc --noEmit` clean; `next build` compiled successfully

## Verification
- Unit: `npx vitest run` → 122/122 pass
- Types: `npx tsc --noEmit` clean
- Live test: user to forward a real email with a top-of-body comment before push (per no-push-until-tested rule)
