---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/settings/SenderRulesSection.tsx
  - src/app/(dashboard)/settings/page.tsx
  - src/app/api/settings/sender-rules/route.ts
  - src/app/api/email/inbound/route.ts
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "User can add a sender rule mapping an email address to a YNAB account"
    - "User can delete an existing sender rule"
    - "When an inbound email matches a sender rule, that rule's accountId is used instead of the default"
    - "When no rule matches, the default selectedAccountId is used (existing behavior)"
    - "Rules are stored per-user in the Setting table under key SENDER_RULES"
  artifacts:
    - path: "src/app/(dashboard)/settings/SenderRulesSection.tsx"
      provides: "Client component for add/delete sender routing rules"
    - path: "src/app/api/settings/sender-rules/route.ts"
      provides: "GET and PUT endpoints for SENDER_RULES setting"
    - path: "src/app/api/email/inbound/route.ts"
      provides: "Inbound pipeline with per-sender accountId override"
  key_links:
    - from: "SenderRulesSection.tsx"
      to: "/api/settings/sender-rules"
      via: "fetch GET on mount, PUT on save"
    - from: "src/app/api/email/inbound/route.ts"
      to: "Setting table (key=SENDER_RULES)"
      via: "prisma.setting.findUnique then JSON.parse to match sender"
---

<objective>
Restore per-sender routing rules: a settings UI section where users add rules that map a sender email address to a specific YNAB account, plus inbound email pipeline integration that applies the matching rule's accountId as an override.

Purpose: Users who receive forwarded emails from multiple senders (e.g., family members) need per-sender account routing, not one global default.
Output: SenderRulesSection component, sender-rules API route, updated inbound pipeline.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key existing patterns:
- Setting table: { userId, key, value } with @@unique([userId, key]) — store SENDER_RULES as JSON string
- YnabConnectionSection fetches budgets via GET /api/ynab/budgets, accounts via GET /api/ynab/budgets/{budgetId}/accounts
- Accounts API returns { accounts: [{ id: string, name: string }] }
- Settings page passes data from server component (page.tsx) to client components as props
- Auth: import { auth } from '@/lib/auth' in API routes, check session?.user?.id
- prisma.setting.upsert({ where: { userId_key: { userId, key } }, update: { value }, create: { userId, key, value } })
- Style conventions: inline styles using the S = { section, sectionTitle, sectionDesc, label, select, fieldRow, hint, btnPrimary, btnDanger } pattern from YnabConnectionSection and SettingsForm

Sender rule shape (stored as JSON string in Setting.value):
  type SenderRule = { email: string; name: string; accountId: string; accountName: string; budgetId: string }
  key = 'SENDER_RULES', value = JSON.stringify(SenderRule[])
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sender rules API route (GET + PUT)</name>
  <files>src/app/api/settings/sender-rules/route.ts</files>
  <action>
Create a new API route at src/app/api/settings/sender-rules/route.ts.

GET handler:
- Auth check: const session = await auth(); if (!session?.user?.id) return 401
- Read the SENDER_RULES setting: prisma.setting.findUnique({ where: { userId_key: { userId: session.user.id, key: 'SENDER_RULES' } } })
- If not found, return { rules: [] }
- Parse the value as JSON and return { rules: SenderRule[] }

PUT handler:
- Auth check same as above
- Parse request body as { rules: SenderRule[] }
- Validate: rules must be an array; each item must have email (non-empty string) and accountId (non-empty string)
- Return 400 with { error: 'Invalid rules' } if validation fails
- Upsert: prisma.setting.upsert({ where: { userId_key: { userId, key: 'SENDER_RULES' } }, update: { value: JSON.stringify(rules) }, create: { userId, key: 'SENDER_RULES', value: JSON.stringify(rules) } })
- Return { ok: true }

Types at top of file:
```typescript
interface SenderRule {
  email: string;
  name: string;
  accountId: string;
  accountName: string;
  budgetId: string;
}
```
  </action>
  <verify>
    curl -X GET http://localhost:3000/api/settings/sender-rules returns 401 without auth (or { rules: [] } if cookie present in browser).
    TypeScript: npx tsc --noEmit passes.
  </verify>
  <done>GET returns { rules: [] } for a user with no rules. PUT saves rules and GET returns them. 401 for unauthenticated requests.</done>
</task>

<task type="auto">
  <name>Task 2: SenderRulesSection client component + wire into settings page</name>
  <files>src/app/(dashboard)/settings/SenderRulesSection.tsx, src/app/(dashboard)/settings/page.tsx</files>
  <action>
Create src/app/(dashboard)/settings/SenderRulesSection.tsx as a 'use client' component.

Props: { connected: boolean; initialBudgetId?: string | null }
(We need the budget for the account picker — reuse the user's currently-selected budget. If none, user must select a budget first.)

State:
- rules: SenderRule[] — loaded on mount via GET /api/settings/sender-rules
- newEmail: string, newName: string — text inputs for adding a rule
- newBudgetId: string — initialized from initialBudgetId prop
- accounts: { id: string; name: string }[] — fetched when newBudgetId changes (same pattern as YnabConnectionSection)
- newAccountId: string — selected from accounts dropdown
- loading: boolean, saving: boolean, error: string

On mount: fetch GET /api/settings/sender-rules and set rules state.

When newBudgetId is non-empty: fetch GET /api/ynab/budgets/{newBudgetId}/accounts and populate accounts state.

Add rule button: validates newEmail non-empty and newAccountId non-empty. Finds selected account name from accounts array. Builds new SenderRule object. Calls PUT /api/settings/sender-rules with [...rules, newRule]. On success, updates rules state, clears form inputs.

Delete rule: filters rules array, calls PUT with new array, updates state.

UI layout (match existing inline style conventions — copy S object from YnabConnectionSection):

```
[section card]
  <h2>Sender Routing Rules</h2>
  <p>Route emails from specific senders to different YNAB accounts. Overrides your default account.</p>

  [If !connected]: show muted text "Connect YNAB first to configure sender rules."

  [If connected]:
    [Existing rules list — or "No rules yet" if empty]
    For each rule:
      flex row: "{rule.name || rule.email}" → "{rule.accountName}" [Delete button]

    [Add rule form]
      Sender email: <input type="email" />
      Sender name (optional): <input type="text" />
      Account: <select> (accounts for initialBudgetId — if no initialBudgetId, show hint "Save a default budget first")
      [Add Rule button]

    [Error message if any]
```

Style the delete button using S.btnDanger. Style Add Rule using S.btnPrimary. The account selector only appears if newBudgetId is non-empty. If initialBudgetId is falsy, show a hint: "Select a default budget above before adding sender rules."

In src/app/(dashboard)/settings/page.tsx:
- Import SenderRulesSection
- Add it between YnabConnectionSection and SettingsForm:
  ```tsx
  <SenderRulesSection
    connected={ynabConnected}
    initialBudgetId={user?.selectedBudgetId}
  />
  ```
No additional data loading needed in page.tsx — the component fetches its own rules on mount.
  </action>
  <verify>
    npx tsc --noEmit passes.
    Visit /settings in browser: Sender Routing Rules section appears between YNAB Connection and Email Processing. If YNAB connected and budget selected: can add a rule (enter email, pick account, click Add Rule) — rule appears in list. Can delete rule. Rules persist on page reload.
  </verify>
  <done>Section renders at /settings. Add/delete rules works. Rules list updates immediately (optimistic). Persists on reload.</done>
</task>

<task type="auto">
  <name>Task 3: Apply sender rules in inbound email pipeline</name>
  <files>src/app/api/email/inbound/route.ts</files>
  <action>
In src/app/api/email/inbound/route.ts, after Step 4 where user.selectedAccountId is confirmed non-null, add a sender rule lookup before Step 6.

Insert between Step 4 (budget/account check) and Step 5 (parse email):

```typescript
// Step 4b: Check for per-sender routing rule override
const senderRuleSetting = await prisma.setting.findUnique({
  where: { userId_key: { userId, key: 'SENDER_RULES' } },
});

let accountId = user.selectedAccountId;  // default
if (senderRuleSetting?.value) {
  try {
    const rules = JSON.parse(senderRuleSetting.value) as Array<{ email: string; accountId: string }>;
    // Normalize sender: Postmark From may be "Name <email@example.com>"
    const senderEmail = (body.From as string ?? '').replace(/.*<(.+)>.*/, '$1').trim().toLowerCase();
    const match = rules.find((r) => r.email.toLowerCase() === senderEmail);
    if (match?.accountId) {
      accountId = match.accountId;
    }
  } catch {
    // Malformed rules JSON — fall back to default accountId
  }
}
```

Then in Step 6, change the two lines:
```typescript
const budgetId = user.selectedBudgetId;
const accountId = user.selectedAccountId;
```
to:
```typescript
const budgetId = user.selectedBudgetId;
// accountId already resolved above (with sender rule override if applicable)
```
(Remove the `const accountId = user.selectedAccountId;` line since accountId is declared above.)

The rest of the pipeline (getAccountName, createYnabTransaction, writeActivityLog) already uses accountId — no further changes needed.
  </action>
  <verify>
    npx tsc --noEmit passes.
    Manual verification: add a sender rule for your own email → selectedAccount X. Send a test email from that address. Check activity log — ynabResult.accountId should be X (the rule's account), not the default selectedAccountId.
  </verify>
  <done>Inbound emails from a sender with a matching rule use that rule's accountId. Emails with no matching rule use the default selectedAccountId. Malformed SENDER_RULES JSON falls back to default gracefully.</done>
</task>

</tasks>

<verification>
1. npx tsc --noEmit — no TypeScript errors
2. Visit /settings — Sender Routing Rules section visible between YNAB Connection and Email Processing
3. Add a rule (email + account) — appears in list immediately
4. Reload — rule persists
5. Delete a rule — removed from list, persists on reload
6. Send test email from a ruled sender — activity log shows the rule's accountId in ynabResult
</verification>

<success_criteria>
- Per-sender routing rules can be added and deleted via /settings
- Rules are stored as SENDER_RULES JSON in the Setting table per user
- Inbound email pipeline matches sender email to rules and overrides accountId when a match is found
- No regression: emails with no matching rule still use the default selectedAccountId
</success_criteria>

<output>
After completion, create .planning/quick/4-restore-per-sender-routing-rules-ui-and-/4-SUMMARY.md
</output>
