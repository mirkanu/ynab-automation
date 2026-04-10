# Phase 14: Settings Editor - Research

**Researched:** 2026-03-27
**Domain:** Admin UI for editing env vars with Railway API sync
**Confidence:** HIGH

## Summary

Phase 14 adds a Settings page at `/settings` where the admin can view and edit all configuration. The existing `/api/setup/apply` endpoint already handles Railway env var updates via GraphQL — the settings editor reuses this exact mechanism.

The settings are organized into sections:
1. **Sender Routing** (SET-01): SENDERS JSON — add/edit/remove email→account mappings
2. **Currency Routing** (SET-02): CURRENCY_ACCOUNTS JSON — add/edit/remove currency→account mappings
3. **API Keys** (SET-03): YNAB_PERSONAL_ACCESS_TOKEN, RESEND_API_KEY, ANTHROPIC_API_KEY
4. **Other Settings** (SET-04): ADMIN_EMAIL, INBOUND_EMAIL, ADMIN_PASSWORD
5. **Save to Railway** (SET-05): Uses existing `/api/setup/apply` endpoint

## Architecture

### Reading Current Values
Server component reads `process.env.*` and passes current values as props to a client component form. This works because:
- Settings page is `force-dynamic` (renders at request time)
- Server has access to all env vars
- Client component receives values as initial form state

### Editing Pattern
- Client component with local form state initialized from server props
- User edits values in the form
- On save, client POSTs to `/api/setup/apply` with the Railway token and updated variables
- On success, the page reloads to show updated values (Railway restarts the service)

### SENDERS/CURRENCY_ACCOUNTS Editing
Reuse the same pattern as SetupWizard:
- SENDERS: array of `{email, name, accountId, notificationLabel?}` — rendered as repeating fieldsets
- CURRENCY_ACCOUNTS: object of `{currency: accountId}` — rendered as key-value pairs
- Both stored as JSON strings in env vars

### Security
- Page is behind auth middleware (same as dashboard)
- Railway token is entered by the user each time (not stored)
- API keys are shown as password fields (masked by default)

## File Structure

```
src/app/(dashboard)/settings/
└── page.tsx         # Server component reading env vars + client form
```

The settings page is a single file — a server component wrapper that reads env vars, plus an inline or separate client component for the form. Given the complexity of the form (senders array, currency array, multiple fields), a separate client component is cleaner:

```
src/app/(dashboard)/settings/
├── page.tsx                    # Server component, reads env vars
└── SettingsForm.tsx            # Client component, form + save logic
```
