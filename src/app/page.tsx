import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await auth()
  // Authenticated users go to dashboard
  if (session?.user?.id) redirect('/dashboard')

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ padding: '1rem 2rem', backgroundColor: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>YNAB Automation</span>
        <a href="/auth/signin" style={{ color: '#d1d5db', fontSize: '0.875rem', textDecoration: 'none' }}>Sign in</a>
      </header>

      {/* Hero */}
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '4rem 2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111827', lineHeight: 1.2, marginBottom: '1rem' }}>
          Your order emails, automatically in YNAB
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#374151', lineHeight: 1.7, marginBottom: '2rem' }}>
          Forward any order confirmation email to your unique address. We parse it with AI and create the YNAB transaction automatically — no manual entry, no Pipedream required.
        </p>
        <a
          href="/auth/signin"
          style={{
            display: 'inline-block',
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '0.875rem 2rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '1rem',
            textDecoration: 'none',
          }}
        >
          Sign up free
        </a>

        {/* How it works */}
        <div style={{ marginTop: '4rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem' }}>How it works</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { step: '1', title: 'Connect your YNAB account', desc: 'Sign up and connect via YNAB OAuth — no passwords shared.' },
              { step: '2', title: 'Get your forwarding address', desc: 'You receive a unique email address. Set up a forwarding filter in Gmail, Outlook, or Apple Mail.' },
              { step: '3', title: 'Forward order emails', desc: 'Any order confirmation lands in your inbox? Forward it. We detect the retailer, amount, and date using Claude AI.' },
              { step: '4', title: 'Transaction appears in YNAB', desc: 'The transaction is created in your selected account automatically, ready to categorize.' },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: '0.875rem' }}>
                  {step}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>{title}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
        YNAB Automation — Made with Claude AI
      </footer>
    </div>
  )
}
