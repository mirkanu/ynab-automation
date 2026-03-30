/**
 * Extracts safe display fields from a Claude parse result.
 * Strips debug fields (stop_reason, token counts, model info) that should not be shown in UI.
 */
export interface ParseResultDisplay {
  retailer?: string
  amount?: number
  date?: string
  currency?: string
  description?: string
}

export function formatParseResult(
  parseResult: Record<string, unknown> | null | undefined,
): ParseResultDisplay | null {
  if (!parseResult) return null

  const result: ParseResultDisplay = {}

  if (parseResult.retailer !== undefined) result.retailer = String(parseResult.retailer)
  if (parseResult.amount !== undefined) result.amount = Number(parseResult.amount)
  if (parseResult.date !== undefined) result.date = String(parseResult.date)
  if (parseResult.currency !== undefined) result.currency = String(parseResult.currency)
  if (parseResult.description !== undefined) result.description = String(parseResult.description)

  return result
}
