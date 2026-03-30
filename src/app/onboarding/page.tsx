import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { detectEmailProvider, getForwardingInstructions } from '@/lib/email-providers'
import OnboardingSteps from './OnboardingSteps'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true, oauthToken: true, forwardingEmail: true, email: true },
  })

  if (user?.onboardingCompleted) redirect('/')

  const provider = detectEmailProvider(session.user.email ?? '')
  const instructions = user?.forwardingEmail
    ? getForwardingInstructions(provider, user.forwardingEmail)
    : null

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
        Welcome! Let&apos;s get you set up
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.875rem' }}>
        Follow these 3 steps to start processing your order confirmation emails automatically.
      </p>
      <OnboardingSteps
        ynabConnected={!!user?.oauthToken}
        forwardingEmail={user?.forwardingEmail ?? null}
        providerTitle={instructions?.title ?? null}
        providerSteps={instructions?.steps ?? null}
        providerHelpUrl={instructions?.helpUrl ?? null}
      />
    </div>
  )
}
