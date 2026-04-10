'use server'

import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getSetting } from '@/lib/settings'

export async function loginAction(
  prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error: string }> {
  const password = formData.get('password') as string

  // Read from DB first (AUTH-05: changeable without redeploy),
  // fall back to env var for bootstrap (first deploy before settings are saved).
  const adminPassword = await getSetting('ADMIN_PASSWORD') ?? process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    throw new Error('No admin password configured. Set ADMIN_PASSWORD env var or configure via settings.')
  }

  if (password !== adminPassword) {
    return { error: 'Invalid password' }
  }

  const session = await getAdminSession()
  session.isLoggedIn = true
  await session.save()

  redirect('/dashboard')
}
