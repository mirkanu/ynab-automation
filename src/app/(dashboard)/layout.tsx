import { type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { loadDbSettings, getSetting } from '@/lib/settings'
import TestModeBanner from './components/TestModeBanner'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  await loadDbSettings()
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
      <nav style={{
        display: 'flex',
        gap: '1.5rem',
        padding: '0.5rem 1.5rem',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        fontSize: '0.8125rem',
        fontWeight: 500,
      }}>
        <a href="/dashboard" style={{ color: '#374151', textDecoration: 'none' }}>Dashboard</a>
        <a href="/logs" style={{ color: '#374151', textDecoration: 'none' }}>Activity Log</a>
        <a href="/settings" style={{ color: '#374151', textDecoration: 'none' }}>Settings</a>
        <a href="/tools" style={{ color: '#374151', textDecoration: 'none' }}>Tools</a>
      </nav>
      <TestModeBanner testMode={testMode} />
      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
