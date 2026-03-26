import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

export async function POST() {
  const session = await getAdminSession();
  // session.destroy() is the correct iron-session API for logout.
  // Do NOT manually delete the cookie — destroy() handles the correct
  // path/domain attributes that were set when the cookie was created.
  await session.destroy();
  return NextResponse.redirect(
    new URL('/admin/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  );
}
