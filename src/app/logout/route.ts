import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  await session.destroy();
  return NextResponse.redirect(new URL('/login', request.url));
}
