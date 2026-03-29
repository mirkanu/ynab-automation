'use client'

import { useState, FormEvent } from 'react'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('email', email)

      const response = await fetch('/api/auth/signin/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackUrl: '/', redirect: false }),
      })

      if (response.ok) {
        window.location.href = '/auth/verify-request'
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Failed to send magic link. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
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
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: loading ? '#6b7280' : '#111827',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? 'Sending link...' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  )
}
