import { NextRequest, NextResponse } from 'next/server';
import { loadSettingsForUser, saveSettingsForUser } from '@/lib/settings';
import { prisma } from '@/lib/db';

const INITIAL_USER_EMAIL = process.env.ADMIN_EMAIL ?? 'manuelkuhs@gmail.com';

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

export async function GET() {
  try {
    const userId = await getInitialUserId();
    if (!userId) {
      return NextResponse.json({});
    }
    const result = await loadSettingsForUser(userId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to load settings: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { settings: Record<string, string> };
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 });
    }
    const userId = await getInitialUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Initial user not found — run backfill first' }, { status: 503 });
    }
    const count = await saveSettingsForUser(userId, body.settings);
    return NextResponse.json({ success: true, count });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save settings: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
