'use client'

import { useState, useEffect } from 'react'

interface Field {
  label: string
  key: string
  type: 'password' | 'text'
  hint: string
}

const FIELDS: Field[] = [
  {
    label: 'YNAB Personal Access Token',
    key: 'YNAB_ACCESS_TOKEN',
    type: 'password',
    hint: 'Get your token at ynab.com/settings/developer',
  },
  {
    label: 'Anthropic Claude API Key',
    key: 'ANTHROPIC_API_KEY',
    type: 'password',
    hint: 'Get your key at console.anthropic.com',
  },
  {
    label: 'Resend API Key',
    key: 'RESEND_API_KEY',
    type: 'password',
    hint: 'Get your key at resend.com/api-keys',
  },
  {
    label: 'Pipedream Webhook URL',
    key: 'PIPEDREAM_WEBHOOK_URL',
    type: 'text',
    hint: 'The webhook URL from your Pipedream workflow',
  },
]

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
  },
  fieldRow: {
    marginBottom: '0.875rem',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
    lineHeight: 1.4,
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
  successMsg: {
    fontSize: '0.8125rem',
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '0.5rem 0.875rem',
    marginTop: '0.75rem',
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

export default function ApiKeysSection() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    async function loadSettings() {
      setLoadingInitial(true)
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json() as Record<string, string>
          // Populate only the keys we manage
          const populated: Record<string, string> = {}
          for (const f of FIELDS) {
            populated[f.key] = data[f.key] ?? ''
          }
          setValues(populated)
        }
      } catch {
        // Non-critical — inputs will start empty
      } finally {
        setLoadingInitial(false)
      }
    }
    void loadSettings()
  }, [])

  const handleChange = (key: string, value: string) => {
    setSaveResult('idle')
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveResult('idle')
    try {
      // Only send non-empty fields
      const toSave: Record<string, string> = {}
      for (const [k, v] of Object.entries(values)) {
        if (v.trim()) {
          toSave[k] = v.trim()
        }
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: toSave }),
      })
      if (res.ok) {
        setSaveResult('success')
      } else {
        setSaveResult('error')
      }
    } catch {
      setSaveResult('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>API Keys</h2>
      <p style={S.sectionDesc}>
        Configure the API keys and webhook URLs used by this app. Values are stored securely in the database — no redeploy required.
      </p>

      {loadingInitial ? (
        <p style={S.hint}>Loading current values...</p>
      ) : (
        <>
          {FIELDS.map((field) => (
            <div key={field.key} style={S.fieldRow}>
              <label style={S.label} htmlFor={`apikey-${field.key}`}>
                {field.label}
              </label>
              <input
                id={`apikey-${field.key}`}
                type={field.type}
                value={values[field.key] ?? ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                style={S.input}
                placeholder={field.type === 'password' ? '••••••••••••' : 'https://...'}
                disabled={saving}
                autoComplete="off"
              />
              <p style={S.hint}>{field.hint}</p>
            </div>
          ))}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              ...S.btnPrimary,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
              marginTop: '0.25rem',
            }}
          >
            {saving ? (
              <>
                <span style={S.spinner} />
                Saving...
              </>
            ) : (
              'Save API Keys'
            )}
          </button>

          {saveResult === 'success' && (
            <div style={S.successMsg}>API keys saved successfully.</div>
          )}
          {saveResult === 'error' && (
            <div style={S.errorMsg}>Failed to save API keys. Please try again.</div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
