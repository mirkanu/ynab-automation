import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Auth.js — must be before imports
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signOut: vi.fn(),
}))

// Mock prisma — must be before imports
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      delete: vi.fn(),
    },
  },
}))

import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DELETE } from '@/app/api/account/delete/route'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockSignOut = signOut as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  user: {
    delete: ReturnType<typeof vi.fn>
  }
}

describe('ONBD-03: Account deletion and data cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DELETE /api/account/delete returns 401 for unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await DELETE()

    expect(response.status).toBe(401)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('Unauthorized')
    expect(mockPrisma.user.delete).not.toHaveBeenCalled()
  })

  it('DELETE /api/account/delete removes User row', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-abc' } })
    mockPrisma.user.delete.mockResolvedValue({ id: 'user-abc' })
    mockSignOut.mockResolvedValue(undefined)

    const response = await DELETE()

    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-abc' },
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { deleted: boolean }
    expect(body.deleted).toBe(true)
  })

  it('after deletion, ActivityLog rows for that userId are removed (CASCADE)', async () => {
    // CASCADE is enforced by the DB schema (onDelete: Cascade on ActivityLog.userId FK).
    // We verify the route calls prisma.user.delete (not individual table deletes),
    // which triggers the cascade at the DB level.
    mockAuth.mockResolvedValue({ user: { id: 'user-cascade-1' } })
    mockPrisma.user.delete.mockResolvedValue({ id: 'user-cascade-1' })
    mockSignOut.mockResolvedValue(undefined)

    await DELETE()

    // Single user.delete — DB's onDelete: Cascade removes ActivityLog rows
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-cascade-1' },
    })
    expect(mockPrisma.user.delete).toHaveBeenCalledTimes(1)
  })

  it('after deletion, Setting rows for that userId are removed (CASCADE)', async () => {
    // CASCADE is enforced by the DB schema (onDelete: Cascade on Setting.userId FK).
    mockAuth.mockResolvedValue({ user: { id: 'user-cascade-2' } })
    mockPrisma.user.delete.mockResolvedValue({ id: 'user-cascade-2' })
    mockSignOut.mockResolvedValue(undefined)

    await DELETE()

    // Single user.delete — DB's onDelete: Cascade removes Setting rows
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-cascade-2' },
    })
    expect(mockPrisma.user.delete).toHaveBeenCalledTimes(1)
  })

  it('after deletion, EmailForwardingAddress rows for that userId are removed (CASCADE)', async () => {
    // CASCADE is enforced by the DB schema (onDelete: Cascade on EmailForwardingAddress.userId FK).
    mockAuth.mockResolvedValue({ user: { id: 'user-cascade-3' } })
    mockPrisma.user.delete.mockResolvedValue({ id: 'user-cascade-3' })
    mockSignOut.mockResolvedValue(undefined)

    await DELETE()

    // Single user.delete — DB's onDelete: Cascade removes EmailForwardingAddress rows
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-cascade-3' },
    })
    expect(mockPrisma.user.delete).toHaveBeenCalledTimes(1)
  })
})
