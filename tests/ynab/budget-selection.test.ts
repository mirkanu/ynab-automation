import { describe, it, expect } from 'vitest'

describe('YNAB Budget & Account Selection (YNAB-05)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  it.todo('GET /api/ynab/budgets returns list of budgets for connected user')
  it.todo('GET /api/ynab/budgets returns 401 if user not authenticated')
  it.todo('GET /api/ynab/budgets returns 400 if user has no connected YNAB account')
  it.todo('GET /api/ynab/budgets/:budgetId/accounts returns list of accounts for given budget')
  it.todo('PUT /api/ynab/selection persists selectedBudgetId and selectedAccountId on User row')
  it.todo('PUT /api/ynab/selection returns 400 if budgetId or accountId missing')
})
