import { describe, it, expect } from 'vitest'

describe('YNAB Token Auto-Refresh (YNAB-03)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  it.todo('getValidYnabToken returns decrypted access token when token is not expired')
  it.todo('getValidYnabToken refreshes token when oauthExpiresAt is within 5 minutes')
  it.todo('getValidYnabToken refreshes token when oauthExpiresAt has passed')
  it.todo('getValidYnabToken throws if user has no connected YNAB account (oauthToken is null)')
  it.todo('getValidYnabToken uses lastRefreshAttemptAt mutex: second concurrent request reads refreshed token from DB instead of calling YNAB refresh endpoint again')
  it.todo('Token refresh updates oauthToken, oauthRefreshToken, oauthExpiresAt, and lastRefreshAttemptAt atomically')
})
