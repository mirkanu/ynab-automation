import { getSetting } from '@/lib/settings'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const S = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '560px',
    textAlign: 'center' as const,
  },
  successIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
    display: 'block',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700 as const,
    color: '#111827',
    margin: '0 0 1rem',
  },
  body: {
    fontSize: '0.9375rem',
    color: '#4b5563',
    lineHeight: 1.7,
    margin: '0 0 0.5rem',
  },
  email: {
    fontWeight: 600 as const,
    color: '#111827',
    fontFamily: 'monospace',
    backgroundColor: '#f3f4f6',
    padding: '0.125rem 0.375rem',
    borderRadius: '4px',
  },
  note: {
    fontSize: '0.8125rem',
    color: '#6b7280',
    margin: '0 0 1.75rem',
    lineHeight: 1.6,
  },
  loginLink: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    padding: '0.5625rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: 600 as const,
    backgroundColor: '#2563eb',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '6px',
  },
}

export default async function SetupDone() {
  const pipedreamEmail = await getSetting('PIPEDREAM_WEBHOOK_URL')

  const emailDisplay = pipedreamEmail?.trim()
    ? pipedreamEmail.trim()
    : 'the Pipedream email address you configured in step 6'

  return (
    <div style={S.card}>
      <span style={S.successIcon} role="img" aria-label="Success">
        ✓
      </span>
      <h1 style={S.heading}>You&apos;re all set!</h1>
      <p style={S.body}>
        Forward an Amazon order confirmation email to{' '}
        <span style={S.email}>{emailDisplay}</span>{' '}
        and it will appear in your YNAB account within about 60 seconds.
      </p>
      <p style={S.note}>
        Set up an auto-forward rule in your email client to send order emails automatically.
      </p>
      <Link href="/login" style={S.loginLink}>
        Log in to Dashboard →
      </Link>
    </div>
  )
}
