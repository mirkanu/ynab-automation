import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSetting = vi.fn()
vi.mock('@/lib/settings', () => ({ getSetting: mockGetSetting }))

describe('getLastToolRuns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null for all tools when no settings exist', async () => {
    mockGetSetting.mockResolvedValue(undefined)

    const { getLastToolRuns } = await import('./tool-run-queries')
    const result = await getLastToolRuns()

    expect(result).toEqual({
      transferFix: null,
      eurConversion: null,
      reconciliation: null,
    })
  })

  it('returns parsed ToolRunEntry for transferFix when LAST_RUN_TRANSFER_FIX set', async () => {
    const entry = { runAt: '2026-05-30T10:00:00Z', status: 'success', pairsFixed: 3 }
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'LAST_RUN_TRANSFER_FIX') return Promise.resolve(JSON.stringify(entry))
      return Promise.resolve(undefined)
    })

    const { getLastToolRuns } = await import('./tool-run-queries')
    const result = await getLastToolRuns()

    expect(result.transferFix).toEqual(entry)
    expect(result.eurConversion).toBeNull()
    expect(result.reconciliation).toBeNull()
  })

  it('returns parsed ToolRunEntry for reconciliation when LAST_RUN_RECONCILIATION set', async () => {
    const entry = { runAt: '2026-05-29T15:30:00Z', status: 'success', gapAmount: 12.50 }
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'LAST_RUN_RECONCILIATION') return Promise.resolve(JSON.stringify(entry))
      return Promise.resolve(undefined)
    })

    const { getLastToolRuns } = await import('./tool-run-queries')
    const result = await getLastToolRuns()

    expect(result.reconciliation).toEqual(entry)
    expect(result.transferFix).toBeNull()
    expect(result.eurConversion).toBeNull()
  })

  it('returns null for eurConversion when LAST_RUN_EUR_CONVERSION not set', async () => {
    mockGetSetting.mockResolvedValue(undefined)

    const { getLastToolRuns } = await import('./tool-run-queries')
    const result = await getLastToolRuns()

    expect(result.eurConversion).toBeNull()
  })

  it('returns null for a tool when its Setting value is invalid JSON', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'LAST_RUN_TRANSFER_FIX') return Promise.resolve('not valid json {{')
      return Promise.resolve(undefined)
    })

    const { getLastToolRuns } = await import('./tool-run-queries')
    const result = await getLastToolRuns()

    expect(result.transferFix).toBeNull()
  })
})
