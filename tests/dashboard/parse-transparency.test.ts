import { describe, it, expect } from 'vitest'
import { formatParseResult } from '@/lib/parse-result'

describe('DASH-05: Parse transparency display', () => {
  it('formatParseResult extracts retailer, amount, date, currency from parseResult JSON', () => {
    const input = {
      retailer: 'Amazon',
      amount: 29.99,
      date: '2024-01-15',
      currency: 'GBP',
      description: 'Order #123',
    }

    const result = formatParseResult(input)

    expect(result).not.toBeNull()
    expect(result!.retailer).toBe('Amazon')
    expect(result!.amount).toBe(29.99)
    expect(result!.date).toBe('2024-01-15')
    expect(result!.currency).toBe('GBP')
  })

  it('formatParseResult returns null fields when parseResult is null', () => {
    const result = formatParseResult(null)
    expect(result).toBeNull()
  })

  it('formatParseResult does not expose raw token counts or stop_reason debug fields', () => {
    const input = {
      retailer: 'Amazon',
      amount: 29.99,
      date: '2024-01-15',
      currency: 'GBP',
      stop_reason: 'end_turn',
      input_tokens: 1234,
      output_tokens: 567,
      model: 'claude-3-5-sonnet',
      usage: { input_tokens: 1234, output_tokens: 567 },
    }

    const result = formatParseResult(input)

    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('stop_reason')
    expect(result).not.toHaveProperty('input_tokens')
    expect(result).not.toHaveProperty('output_tokens')
    expect(result).not.toHaveProperty('model')
    expect(result).not.toHaveProperty('usage')
  })

  it('formatParseResult handles missing optional fields gracefully', () => {
    const input = {
      retailer: 'Amazon',
      amount: 29.99,
      // date and currency are missing
    }

    const result = formatParseResult(input)

    expect(result).not.toBeNull()
    expect(result!.retailer).toBe('Amazon')
    expect(result!.amount).toBe(29.99)
    // Missing fields should be absent or empty string, not throw
    expect(result!.date).toBeUndefined()
    expect(result!.currency).toBeUndefined()
  })
})
