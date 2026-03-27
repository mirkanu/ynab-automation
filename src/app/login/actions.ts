'use server';

import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';

export async function loginAction(
  prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error: string }> {
  const password = formData.get('password') as string;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD env var is not set');
  }

  if (password !== adminPassword) {
    return { error: 'Invalid password' };
  }

  const session = await getAdminSession();
  session.isLoggedIn = true;
  await session.save();

  redirect('/');
}
