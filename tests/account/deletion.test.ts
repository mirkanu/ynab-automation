import { describe, it } from 'vitest'
describe('ONBD-03: Account deletion and data cascade', () => {
  it.todo('DELETE /api/account/delete returns 401 for unauthenticated request')
  it.todo('DELETE /api/account/delete removes User row')
  it.todo('after deletion, ActivityLog rows for that userId are removed (CASCADE)')
  it.todo('after deletion, Setting rows for that userId are removed (CASCADE)')
  it.todo('after deletion, EmailForwardingAddress rows for that userId are removed (CASCADE)')
})
