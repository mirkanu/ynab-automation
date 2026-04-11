import { redirect } from 'next/navigation'
import { deriveWizardStep } from '@/lib/wizard'

export const dynamic = 'force-dynamic'

export default async function SetupIndex() {
  const step = await deriveWizardStep()

  if (step >= 7) {
    redirect('/setup/done')
  }

  redirect(`/setup/${step}`)
}
