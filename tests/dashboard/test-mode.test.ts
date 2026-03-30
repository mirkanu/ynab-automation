import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Auth.js
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST } from '@/app/api/settings/test-mode/route'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  user: {
    update: ReturnType<typeof vi.fn>
  }
}

describe('DASH-04: Per-user test mode toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggleTestMode sets testMode=true on User row', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    mockPrisma.user.update.mockResolvedValue({ testMode: true })

    const req = new Request('http://localhost/api/settings/test-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    const body = await response.json() as { testMode: boolean }
    expect(body.testMode).toBe(true)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { testMode: true },
    })
  })

  it('toggleTestMode sets testMode=false on User row', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-456' } })
    mockPrisma.user.update.mockResolvedValue({ testMode: false })

    const req = new Request('http://localhost/api/settings/test-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    const body = await response.json() as { testMode: boolean }
    expect(body.testMode).toBe(false)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-456' },
      data: { testMode: false },
    })
  })

  it('testMode is isolated per user — one user toggling does not affect another', async () => {
    // User A sets testMode = true
    mockAuth.mockResolvedValue({ user: { id: 'user-A' } })
    mockPrisma.user.update.mockResolvedValue({ testMode: true })

    const reqA = new Request('http://localhost/api/settings/test-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })

    await POST(reqA)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-A' },
      data: { testMode: true },
    })

    vi.clearAllMocks()

    // User B sets testMode = false — update only called with user-B's id
    mockAuth.mockResolvedValue({ user: { id: 'user-B' } })
    mockPrisma.user.update.mockResolvedValue({ testMode: false })

    const reqB = new Request('http://localhost/api/settings/test-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })

    await POST(reqB)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-B' },
      data: { testMode: false },
    })
    // Verify user-A was NOT touched
    expect(mockPrisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-A' } }),
    )
  })

  it('testMode persists across requests (read from DB each time)', async () => {
    // First request: unauthenticated → 401
    mockAuth.mockResolvedValue(null)

    const req = new Request('http://localhost/api/settings/test-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})
