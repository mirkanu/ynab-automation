# 03-03 Summary — Wire Webhook + End-to-End Smoke Test

**Completed:** 2026-03-24
**Status:** DONE

## What Was Built

- Wired `parseAmazonEmail` and `createYnabTransaction` into `src/app/api/webhook/route.ts`
- Pipeline: receive → dedup → Amazon filter → Claude parse → YNAB create
- YNAB transactions created uncleared, no category, payee "Amazon", memo `Name: description - Automatically added from email`

## Bugs Found and Fixed During Smoke Test

| Bug | Fix |
|-----|-----|
| Railway BuildKit cache corruption on `tsconfig.tsbuildinfo` — 4 deploys failed silently | Added `nixpacks.toml` to override build cmd; added to `.gitignore` |
| Deployed code was Phase 02 (9abc379) — later commits never reached the server | Fixed by resolving BuildKit failure |
| Claude wrapping JSON in ` ```json ``` ` despite prompt instruction | Strip code fences before `JSON.parse` |
| Transactions created as `cleared` | Changed to `uncleared` |
| `category_id: null` triggering YNAB payee-memory auto-assign (Groceries) | Omit `category_id` entirely from request body |

## Smoke Test Result

✅ Multiple real Amazon order emails forwarded by Manuel → YNAB transactions created correctly:
- Correct account (Manuel's UK Current)
- Correct amount (negative, milliunits)
- Correct memo format
- Uncleared, uncategorized
