import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  await session.destroy();
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return NextResponse.redirect(new URL('/login', `${proto}://${host}`));
}
