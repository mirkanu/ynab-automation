import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSetting } from '@/lib/settings'
import { getAdminSession } from '@/lib/admin-session'

export const dynamic = 'force-dynamic'

const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
  },
  brand: {
    fontSize: '0.8125rem',
    fontWeight: 600 as const,
    color: '#6b7280',
    letterSpacing: '0.01em',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    width: '100%',
  },
}

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const wizardComplete = await getSetting('WIZARD_COMPLETE')
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''

  // Allow /setup/done to render even after wizard completion — it's the success page
  const isDonePage = pathname.endsWith('/done') || pathname === '/setup/done'

  if (wizardComplete === 'true' && !isDonePage) {
    const session = await getAdminSession()
    if (session.isLoggedIn) {
      redirect('/dashboard')
    } else {
      redirect('/login')
    }
  }

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <span style={S.brand}>YNAB Automation — Setup</span>
      </div>
      <main style={S.main}>{children}</main>
    </div>
  )
}
