'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const S = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '560px',
  },
  stepLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700 as const,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#9ca3af',
    marginBottom: '0.375rem',
  },
  heading: {
    fontSize: '1.375rem',
    fontWeight: 700 as const,
    color: '#111827',
    margin: '0 0 0.5rem',
  },
  why: {
    fontSize: '0.875rem',
    color: '#4b5563',
    lineHeight: 1.6,
    margin: '0 0 1rem',
  },
  howList: {
    fontSize: '0.875rem',
    color: '#374151',
    lineHeight: 1.8,
    paddingLeft: '1.25rem',
    margin: '0 0 1rem',
  },
  linkBtn: {
    display: 'inline-block' as const,
    padding: '0.5rem 1rem',
    fontSize: '0.8125rem',
    fontWeight: 600 as const,
    backgroundColor: '#2563eb',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '6px',
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block' as const,
    fontSize: '0.8125rem',
    fontWeight: 600 as const,
    color: '#374151',
    marginBottom: '0.375rem',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    color: '#111827',
    backgroundColor: '#fff',
  },
  fieldRow: {
    marginBottom: '1rem',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex' as const,
    gap: '0.75rem',
    marginTop: '1.5rem',
    alignItems: 'center' as const,
  },
  btnPrimary: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '0.5rem',
    padding: '0.5625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600 as const,
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.1s',
  },
  btnSecondary: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    padding: '0.5625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600 as const,
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'opacity 0.15s',
  },
  errorMsg: {
    fontSize: '0.8125rem',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.5rem 0.875rem',
    marginTop: '0.75rem',
  },
  spinner: {
    display: 'inline-block' as const,
    width: '14px',
    height: '14px',
    border: '2px solid #fff',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
}

export default function SetupStep2() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const disabled = saving || !token.trim()

  async function handleNext() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, settings: { YNAB_ACCESS_TOKEN: token.trim() } }),
      })
      const data = await res.json() as { success?: boolean; nextStep?: number; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to save. Please try again.')
        setSaving(false)
        return
      }
      const next = data.nextStep ?? 3
      router.push(next >= 7 ? '/setup/done' : `/setup/${next}`)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={S.card}>
      <p style={S.stepLabel}>Step 2 of 6</p>
      <h1 style={S.heading}>YNAB Personal Access Token</h1>
      <p style={S.why}>
        This gives the app read/write access to your YNAB budget so it can create transactions automatically.
      </p>

      <ol style={S.howList}>
        <li>Open ynab.com in a new tab</li>
        <li>Go to Account Settings → Developer Settings</li>
        <li>Click &ldquo;New Token&rdquo;, give it any name, copy the token</li>
        <li>Paste it below</li>
      </ol>

      <a
        href="https://app.ynab.com/settings/developer"
        target="_blank"
        rel="noopener noreferrer"
        style={S.linkBtn}
      >
        Open YNAB Developer Settings →
      </a>

      <div style={S.fieldRow}>
        <label style={S.label} htmlFor="ynab-token">Personal Access Token</label>
        <input
          id="ynab-token"
          type="password"
          placeholder="Paste your YNAB token here"
          value={token}
          onChange={(e) => { setToken(e.target.value); setError('') }}
          style={S.input}
          disabled={saving}
          autoComplete="off"
        />
        <p style={S.hint}>
          Your token is stored only in your own Railway database and never shared.
        </p>
      </div>

      {error && <div style={S.errorMsg}>{error}</div>}

      <div style={S.actions}>
        <button
          onClick={() => router.push('/setup/1')}
          style={S.btnSecondary}
          disabled={saving}
        >
          Back
        </button>
        <button
          onClick={() => void handleNext()}
          disabled={disabled}
          style={{
            ...S.btnPrimary,
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? (
            <>
              <span style={S.spinner} />
              Saving...
            </>
          ) : (
            'Next'
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
