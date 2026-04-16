'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'

function generatePassword(): string {
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join('')
}

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
    margin: '0 0 1.5rem',
  },
  label: {
    display: 'block' as const,
    fontSize: '0.8125rem',
    fontWeight: 600 as const,
    color: '#374151',
    marginBottom: '0.375rem',
  },
  labelRow: {
    display: 'flex' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    marginBottom: '0.375rem',
  },
  generateBtn: {
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    background: 'none',
    border: 'none',
    padding: 0,
    fontWeight: 500 as const,
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
  inputWrapper: {
    position: 'relative' as const,
  },
  inputWithCopy: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '0.5rem 2.5rem 0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    color: '#111827',
    backgroundColor: '#fff',
    fontFamily: 'monospace',
  },
  copyBtn: {
    position: 'absolute' as const,
    right: '0.5rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.2rem',
    color: '#6b7280',
    fontSize: '0.75rem',
    display: 'flex' as const,
    alignItems: 'center' as const,
  },
  copyLabel: {
    fontSize: '0.7rem',
    color: '#16a34a',
    fontWeight: 600 as const,
    whiteSpace: 'nowrap' as const,
  },
  fieldRow: {
    marginBottom: '1rem',
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

export default function SetupStep1() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  const mismatch = confirm.length > 0 && password !== confirm
  const disabled = saving || !password.trim() || password !== confirm

  function handleGenerate() {
    const pwd = generatePassword()
    setPassword(pwd)
    setConfirm(pwd)
    setGenerated(true)
    setError('')
    setCopied(false)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available — ignore
    }
  }

  async function handleNext() {
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1, settings: { ADMIN_PASSWORD: password } }),
      })
      const data = await res.json() as { success?: boolean; nextStep?: number; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to save. Please try again.')
        setSaving(false)
        return
      }
      const next = data.nextStep ?? 2
      router.push(next >= 7 ? '/setup/done' : `/setup/${next}`)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={S.card}>
      <p style={S.stepLabel}>Step 1 of 6</p>
      <h1 style={S.heading}>Admin Password</h1>
      <p style={S.why}>
        This is the password you&apos;ll use to log in to the dashboard. Store it somewhere safe.
      </p>

      <div style={S.fieldRow}>
        <div style={S.labelRow}>
          <label style={S.label} htmlFor="password">Choose a password</label>
          <button
            type="button"
            style={S.generateBtn}
            onClick={handleGenerate}
            disabled={saving}
          >
            Generate password
          </button>
        </div>
        <div style={S.inputWrapper}>
          <input
            id="password"
            type={generated ? 'text' : 'password'}
            placeholder="Enter a password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setGenerated(false); setError('') }}
            style={generated ? S.inputWithCopy : S.input}
            disabled={saving}
            autoComplete="new-password"
          />
          {generated && (
            <button
              type="button"
              style={S.copyBtn}
              onClick={() => void handleCopy()}
              title="Copy to clipboard"
            >
              {copied ? (
                <span style={S.copyLabel}>Copied!</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div style={S.fieldRow}>
        <label style={S.label} htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          type="password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError('') }}
          style={{
            ...S.input,
            borderColor: mismatch ? '#f87171' : '#d1d5db',
          }}
          disabled={saving}
          autoComplete="new-password"
        />
        {mismatch && (
          <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>
            Passwords do not match.
          </p>
        )}
      </div>

      {error && <div style={S.errorMsg}>{error}</div>}

      <div style={S.actions}>
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
