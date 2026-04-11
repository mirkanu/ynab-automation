import { prisma } from '@/lib/db'

/**
 * Read a single setting from the database.
 * Returns undefined if the key does not exist or DB is unavailable.
 * Does NOT fall back to process.env — DB is the single source of truth.
 */
export async function getSetting(key: string): Promise<string | undefined> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } })
    return row?.value ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Save settings to the database (upsert by key).
 * Returns the number of settings saved.
 * Does NOT write to process.env.
 */
export async function saveSettings(settings: Record<string, string>): Promise<number> {
  const entries = Object.entries(settings).filter(([, v]) => v !== undefined)
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  )
  return entries.length
}
