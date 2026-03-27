import { type ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
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
        <a href="/" style={{ color: '#374151', textDecoration: 'none' }}>Dashboard</a>
        <a href="/logs" style={{ color: '#374151', textDecoration: 'none' }}>Activity Log</a>
      </nav>
      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  );
}
