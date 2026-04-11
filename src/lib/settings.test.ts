import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { getSetting, saveSettings } from '@/lib/settings'

const mockFindUnique = prisma.setting.findUnique as ReturnType<typeof vi.fn>
const mockUpsert = prisma.setting.upsert as ReturnType<typeof vi.fn>

describe('getSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure process.env does NOT leak into test results
    delete process.env['TEST_SETTING_KEY']
  })

  it('returns the DB value when a row exists', async () => {
    mockFindUnique.mockResolvedValueOnce({ key: 'FOO', value: 'bar' })
    const result = await getSetting('FOO')
    expect(result).toBe('bar')
  })

  it('returns undefined when no DB row exists (no env fallback)', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    process.env['TEST_SETTING_KEY'] = 'should-not-be-returned'
    const result = await getSetting('TEST_SETTING_KEY')
    expect(result).toBeUndefined()
  })

  it('returns undefined when DB throws (no env fallback)', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB error'))
    process.env['TEST_SETTING_KEY'] = 'should-not-be-returned'
    const result = await getSetting('TEST_SETTING_KEY')
    expect(result).toBeUndefined()
  })
})

describe('saveSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsert.mockResolvedValue({ key: 'X', value: 'y' })
  })

  it('upserts each key/value pair to the DB', async () => {
    await saveSettings({ FOO: 'bar', BAZ: 'qux' })
    expect(mockUpsert).toHaveBeenCalledTimes(2)
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: 'FOO' },
      update: { value: 'bar' },
      create: { key: 'FOO', value: 'bar' },
    })
  })

  it('returns the number of entries saved', async () => {
    const count = await saveSettings({ A: '1', B: '2', C: '3' })
    expect(count).toBe(3)
  })

  it('does NOT write to process.env', async () => {
    delete process.env['SAVE_TEST_KEY']
    await saveSettings({ SAVE_TEST_KEY: 'some-value' })
    expect(process.env['SAVE_TEST_KEY']).toBeUndefined()
  })
})
