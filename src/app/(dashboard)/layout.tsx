import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';
import { loadDbSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/auth/signin');
  }

  await loadDbSettings();
  const testMode = process.env.TEST_MODE === 'true';

  async function handleSignOut() {
    'use server'
    await signOut({ redirectTo: '/auth/signin' })
  }

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
        <form action={handleSignOut}>
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
        <a href="/" style={{ color: '#374151', textDecoration: 'none' }}>Dashboard</a>
        <a href="/logs" style={{ color: '#374151', textDecoration: 'none' }}>Activity Log</a>
        <a href="/settings" style={{ color: '#374151', textDecoration: 'none' }}>Settings</a>
        <a href="/tools" style={{ color: '#374151', textDecoration: 'none' }}>Tools</a>
      </nav>
      {testMode && (
        <div style={{
          backgroundColor: '#dcfce7',
          borderBottom: '1px solid #86efac',
          padding: '0.5rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
        }}>
          <div>
            <span style={{ fontWeight: 600, color: '#166534' }}>Test Mode</span>
            <span style={{ color: '#166534', marginLeft: '0.375rem' }}>
              — Emails are parsed but not written to YNAB
            </span>
          </div>
          <a href="/settings" style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 500 }}>
            Settings
          </a>
        </div>
      )}
      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  );
}
