import { describe, it, expect } from 'vitest'

describe('YNAB OAuth Flow (YNAB-01)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  it.todo('GET /api/ynab/authorize redirects to YNAB consent URL with client_id, redirect_uri, response_type=code, state param')
  it.todo('GET /api/ynab/authorize returns 401 if user not authenticated')
  it.todo('GET /api/ynab/callback exchanges code for tokens and stores encrypted in User row')
  it.todo('GET /api/ynab/callback returns 400 if code param is missing')
  it.todo('GET /api/ynab/callback returns 401 if user not authenticated')
  it.todo('GET /api/ynab/callback redirects to /dashboard/settings?ynab_connected=true on success')
})
