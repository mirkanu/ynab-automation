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
  providerGroup: {
    display: 'flex' as const,
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  providerBtn: {
    flex: 1 as const,
    padding: '0.625rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: 600 as const,
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
  },
  providerBtnActive: {
    backgroundColor: '#2563eb',
    color: '#fff',
    borderColor: '#2563eb',
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

type Provider = 'minimax' | 'anthropic'

const PROVIDER_META: Record<Provider, { label: string; placeholder: string; hint: string }> = {
  anthropic: {
    label: 'Anthropic (Claude 3.5 Haiku)',
    placeholder: 'sk-ant-...',
    hint: 'Get your key at console.anthropic.com — the Claude Messages API is used to parse the email.',
  },
  minimax: {
    label: 'MiniMax (MiniMax-M3)',
    placeholder: 'eyJ...',
    hint: 'Get your key at MiniMax — the MiniMax-M3 model is used to parse the email.',
  },
}

export default function SetupStep4() {
  const router = useRouter()
  const [provider, setProvider] = useState<Provider>('minimax')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const disabled = saving || !apiKey.trim()

  async function handleNext() {
    setSaving(true)
    setError('')
    try {
      const trimmedKey = apiKey.trim()
      const res = await fetch('/api/setup/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 4,
          settings: {
            LLM_PROVIDER: provider,
            // Both keys are sent — the chosen provider's key holds the real value,
            // the other is empty. deriveWizardStep requires both to be non-empty
            // for step 4 to count as done, so the user must fill the matching key
            // to advance; the empty slot acts as a guard.
            ANTHROPIC_API_KEY: provider === 'anthropic' ? trimmedKey : '',
            MINIMAX_API_KEY: provider === 'minimax' ? trimmedKey : '',
          },
        }),
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

  const meta = PROVIDER_META[provider]

  return (
    <div style={S.card}>
      <p style={S.stepLabel}>Step 4 of 6</p>
      <h1 style={S.heading}>LLM Provider API Key</h1>
      <p style={S.why}>
        Choose which LLM provider reads your forwarded emails and extracts the order details (retailer, amount, currency) so they can become YNAB transactions. You can switch providers later from the Settings page — both keys are stored in the database.
      </p>

      <div style={S.providerGroup}>
        {(Object.keys(PROVIDER_META) as Provider[]).map((p) => {
          const active = provider === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              style={{
                ...S.providerBtn,
                ...(active ? S.providerBtnActive : {}),
              }}
              disabled={saving}
            >
              {PROVIDER_META[p].label}
            </button>
          )
        })}
      </div>

      <a
        href={provider === 'anthropic' ? 'https://console.anthropic.com/settings/keys' : 'https://www.minimax.io'}
        target="_blank"
        rel="noopener noreferrer"
        style={S.linkBtn}
      >
        {provider === 'anthropic' ? 'Open Anthropic Console →' : 'Open MiniMax →'}
      </a>

      <div style={S.fieldRow}>
        <label style={S.label} htmlFor="llm-api-key">API Key</label>
        <input
          id="llm-api-key"
          type="password"
          placeholder={meta.placeholder}
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setError('') }}
          style={S.input}
          disabled={saving}
          autoComplete="off"
        />
        <p style={S.hint}>{meta.hint}</p>
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
