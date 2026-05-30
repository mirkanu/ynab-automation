import { type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getSetting } from '@/lib/settings'
import TestModeBanner from './components/TestModeBanner'
import Navigation from './components/Navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const wizardComplete = await getSetting('WIZARD_COMPLETE')
  if (wizardComplete !== 'true') {
    redirect('/setup')
  }

  // Auth is centralized here for all dashboard routes. Child pages intentionally
  // also call getAdminSession() as defence-in-depth — do not remove page-level
  // guards thinking they are redundant; they protect against future layout refactors.
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const testModeValue = await getSetting('TEST_MODE')
  const testMode = testModeValue === 'true'

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#111827',
        color: 'white',
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>YNAB Automation — Admin</span>
        <form action="/logout" method="POST">
          <button
            type="submit"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </form>
      </header>
      <Navigation />
      <TestModeBanner testMode={testMode} />
      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
