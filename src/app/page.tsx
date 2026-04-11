import { redirect } from 'next/navigation'
import { getSetting } from '@/lib/settings'
import { getAdminSession } from '@/lib/admin-session'
import { deriveWizardStep } from '@/lib/wizard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const wizardComplete = await getSetting('WIZARD_COMPLETE')

  if (wizardComplete !== 'true') {
    const step = await deriveWizardStep()
    redirect(`/setup/${step}`)
  }

  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  redirect('/dashboard')
}
