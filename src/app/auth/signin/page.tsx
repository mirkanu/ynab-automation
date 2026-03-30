import { signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const error = searchParams.error

  async function handleSignIn(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    if (!email) return
    try {
      await signIn('resend', { email, redirectTo: '/dashboard' })
    } catch (e: unknown) {
      // Auth.js throws a NEXT_REDIRECT on success — let it propagate
      if (e instanceof Error && e.message?.includes('NEXT_REDIRECT')) {
        throw e
      }
      redirect('/auth/signin?error=EmailSendFailed')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '360px',
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}
        >
          YNAB Automation
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          Enter your email to receive a sign-in link
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: '#dc2626',
            }}
          >
            {error === 'EmailSendFailed'
              ? 'Failed to send magic link. Please try again.'
              : 'Something went wrong. Please try again.'}
          </div>
        )}

        <form action={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: '#111827',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            Send magic link
          </button>
        </form>
      </div>
    </div>
  )
}
