'use client'
import { useState } from 'react'

const S = {
  section: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 700 as const,
    color: '#111827',
    margin: '0 0 0.25rem',
  },
  sectionDesc: {
    fontSize: '0.8125rem',
    color: '#6b7280',
    margin: '0 0 1.25rem',
    lineHeight: 1.5,
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
    marginBottom: '0.875rem',
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
    transition: 'opacity 0.15s',
  },
}

export function AdminPasswordSection() {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult('idle')
    if (newPw.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPw !== confirmPw) {
      setError('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ADMIN_PASSWORD: newPw } }),
      })
      if (!res.ok) {
        setResult('error')
        return
      }
      setResult('success')
      setNewPw('')
      setConfirmPw('')
    } catch {
      setResult('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>Admin Password</h2>
      <p style={S.sectionDesc}>
        Change the admin password used to log in to this dashboard. The new password is stored in the database and takes effect immediately — no redeploy required.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label style={S.label} htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            style={S.input}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            disabled={saving}
          />
        </div>
        <div>
          <label style={S.label} htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            style={S.input}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            disabled={saving}
          />
        </div>
        {error && (
          <div style={{ fontSize: '0.8125rem', color: '#dc2626', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}
        {result === 'success' && (
          <div style={{ fontSize: '0.8125rem', color: '#16a34a', marginBottom: '0.75rem' }}>
            Password updated successfully.
          </div>
        )}
        {result === 'error' && !error && (
          <div style={{ fontSize: '0.8125rem', color: '#dc2626', marginBottom: '0.75rem' }}>
            Failed to update password. Please try again.
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          style={{
            ...S.btnPrimary,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? (
            <>
              <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              Saving...
            </>
          ) : (
            'Update Password'
          )}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </form>
    </div>
  )
}
