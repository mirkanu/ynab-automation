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

export default function SetupStep4() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const disabled = saving || !apiKey.trim()

  async function handleNext() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 4, settings: { ANTHROPIC_API_KEY: apiKey.trim() } }),
      })
      const data = await res.json() as { success?: boolean; nextStep?: number; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to save. Please try again.')
        setSaving(false)
        return
      }
      const next = data.nextStep ?? 5
      router.push(next >= 7 ? '/setup/done' : `/setup/${next}`)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={S.card}>
      <p style={S.stepLabel}>Step 4 of 6</p>
      <h1 style={S.heading}>Anthropic Claude API Key</h1>
      <p style={S.why}>
        Claude reads your forwarded emails and extracts the order details (retailer, amount, currency) so they can become YNAB transactions.
      </p>

      <ol style={S.howList}>
        <li>Go to console.anthropic.com</li>
        <li>Sign up or log in (a free account is fine to start)</li>
        <li>Click &ldquo;API Keys&rdquo; in the left sidebar → &ldquo;Create Key&rdquo;</li>
        <li>Give the key a name (e.g. &ldquo;YNAB Automation&rdquo;), copy it</li>
        <li>You&apos;ll need to add a few dollars of credit under &ldquo;Billing&rdquo; — at household email volume this will last months</li>
      </ol>

      <a
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noopener noreferrer"
        style={S.linkBtn}
      >
        Open Anthropic Console →
      </a>

      <div style={S.fieldRow}>
        <label style={S.label} htmlFor="anthropic-key">API Key</label>
        <input
          id="anthropic-key"
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setError('') }}
          style={S.input}
          disabled={saving}
          autoComplete="off"
        />
        <p style={S.hint}>Your key is stored only in your Railway database.</p>
      </div>

      {error && <div style={S.errorMsg}>{error}</div>}

      <div style={S.actions}>
        <button
          onClick={() => router.push('/setup/3')}
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
