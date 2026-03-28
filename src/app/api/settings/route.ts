import { NextRequest, NextResponse } from 'next/server';
import { saveSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
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
    const count = await saveSettings(body.settings);
    return NextResponse.json({ success: true, count });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save settings: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
