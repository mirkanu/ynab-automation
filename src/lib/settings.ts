import { prisma } from '@/lib/db';

const INITIAL_USER_EMAIL = process.env.ADMIN_EMAIL ?? 'manuelkuhs@gmail.com';

/**
 * Look up the initial user's id by email.
 * Returns null if the user does not exist yet (e.g., before first login / backfill).
 */
async function getInitialUserId(): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: INITIAL_USER_EMAIL },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Load all settings from the database and apply them to process.env.
 * DB values override env vars, so changes take effect without a restart.
 * Falls back to existing env vars when no DB entry exists.
 *
 * This is a temporary shim that uses the initial user's settings until
 * Phase 19 wires full per-user settings into the UI.
 */
export async function loadDbSettings(): Promise<void> {
  try {
    const userId = await getInitialUserId();
    if (!userId) return; // No initial user yet — use env vars as-is

    const settings = await prisma.setting.findMany({ where: { userId } });
    for (const s of settings) {
      process.env[s.key] = s.value;
    }
  } catch {
    // DB not available (e.g., during build) — use env vars as-is
  }
}

/**
 * Save settings to the database (upsert) scoped to a specific user.
 * Returns the number of settings saved.
 */
export async function saveSettingsForUser(
  userId: string,
  settings: Record<string, string>
): Promise<number> {
  const entries = Object.entries(settings).filter(([, v]) => v !== undefined);
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { userId_key: { userId, key } },
        update: { value },
        create: { userId, key, value },
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
 * Load all settings from the database scoped to a specific user.
 * Returns a key-value map of settings.
 */
export async function loadSettingsForUser(
  userId: string
): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany({ where: { userId } });
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

/**
 * Save settings to the database (upsert) — uses the initial user as a shim
 * until Phase 19 wires full per-user settings.
 * Returns the number of settings saved.
 */
export async function saveSettings(settings: Record<string, string>): Promise<number> {
  const userId = await getInitialUserId();
  if (!userId) {
    // No user yet — write to process.env only (will be persisted once user exists)
    for (const [key, value] of Object.entries(settings)) {
      process.env[key] = value;
    }
    return Object.keys(settings).length;
  }
  return saveSettingsForUser(userId, settings);
}

/**
 * Read a single setting from DB, falling back to process.env.
 * Uses the initial user as a shim until Phase 19 wires full per-user settings.
 */
export async function getSetting(key: string): Promise<string | undefined> {
  try {
    const userId = await getInitialUserId();
    if (!userId) return process.env[key];

    const row = await prisma.setting.findUnique({
      where: { userId_key: { userId, key } },
    });
    return row?.value ?? process.env[key];
  } catch {
    return process.env[key];
  }
}
