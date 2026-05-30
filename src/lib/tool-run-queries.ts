import { getSetting } from '@/lib/settings'

export interface ToolRunEntry {
  runAt: string        // ISO string
  status: 'success' | 'partial' | 'error'
  pairsFixed?: number
  converted?: number
  gapAmount?: number
}

export interface LastToolRuns {
  transferFix: ToolRunEntry | null
  eurConversion: ToolRunEntry | null
  reconciliation: ToolRunEntry | null
}

function parseToolRun(raw: string | undefined): ToolRunEntry | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ToolRunEntry
  } catch {
    return null
  }
}

export async function getLastToolRuns(): Promise<LastToolRuns> {
  const [transferFixRaw, eurConversionRaw, reconciliationRaw] = await Promise.all([
    getSetting('LAST_RUN_TRANSFER_FIX'),
    getSetting('LAST_RUN_EUR_CONVERSION'),
    getSetting('LAST_RUN_RECONCILIATION'),
  ])

  return {
    transferFix: parseToolRun(transferFixRaw),
    eurConversion: parseToolRun(eurConversionRaw),
    reconciliation: parseToolRun(reconciliationRaw),
  }
}
