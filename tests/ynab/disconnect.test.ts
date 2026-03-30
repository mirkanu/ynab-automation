import { describe, it, expect } from 'vitest'

describe('YNAB Disconnect (YNAB-04)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  it.todo('POST /api/ynab/disconnect clears oauthToken, oauthRefreshToken, oauthExpiresAt, selectedBudgetId, selectedAccountId for the user')
  it.todo('POST /api/ynab/disconnect returns { status: "disconnected" }')
  it.todo('POST /api/ynab/disconnect returns 401 if user not authenticated')
  it.todo('After disconnect, GET /api/ynab/status returns { connected: false }')
})
