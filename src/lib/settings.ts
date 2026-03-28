import { prisma } from '@/lib/db';

/**
 * Load all settings from the database and apply them to process.env.
 * DB values override env vars, so changes take effect without a restart.
 * Falls back to existing env vars when no DB entry exists.
 */
export async function loadDbSettings(): Promise<void> {
  try {
    const settings = await prisma.setting.findMany();
    for (const s of settings) {
      process.env[s.key] = s.value;
    }
  } catch {
    // DB not available (e.g., during build) — use env vars as-is
  }
}

/**
 * Save settings to the database (upsert).
 * Returns the number of settings saved.
 */
export async function saveSettings(settings: Record<string, string>): Promise<number> {
  const entries = Object.entries(settings).filter(([, v]) => v !== undefined);
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  // Also apply to current process immediately
  for (const [key, value] of entries) {
    process.env[key] = value;
  }
  return entries.length;
}

/**
 * Read a single setting from DB, falling back to process.env.
 */
export async function getSetting(key: string): Promise<string | undefined> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? process.env[key];
  } catch {
    return process.env[key];
  }
}
