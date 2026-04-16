'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Budget {
  id: string
  name: string
}

interface Account {
  id: string
  name: string
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
  select: {
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
  hint: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
    lineHeight: 1.4,
  },
}

export default function SetupStep3() {
  const router = useRouter()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedBudgetId, setSelectedBudgetId] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [loadingBudgets, setLoadingBudgets] = useState(true)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchAccounts = useCallback(async (budgetId: string) => {
    if (!budgetId) {
      setAccounts([])
      return
    }
    setLoadingAccounts(true)
    try {
      const res = await fetch(`/api/ynab/budgets/${budgetId}/accounts`)
      if (res.ok) {
        const data = await res.json() as { accounts: Account[] }
        setAccounts(data.accounts)
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    async function loadBudgets() {
      setLoadingBudgets(true)
      try {
        const res = await fetch('/api/ynab/budgets')
        if (!res.ok) {
          setError('Could not load budgets. Go back to Step 2 and save your YNAB token first.')
          return
        }
        const data = await res.json() as { budgets: Budget[] }
        setBudgets(data.budgets)
      } catch {
        setError('Could not load budgets. Go back to Step 2 and save your YNAB token first.')
      } finally {
        setLoadingBudgets(false)
      }
    }
    void loadBudgets()
  }, [])

  const handleBudgetChange = async (budgetId: string) => {
    setSelectedBudgetId(budgetId)
    setSelectedAccountId('')
    setAccounts([])
    if (budgetId) {
      await fetchAccounts(budgetId)
    }
  }

  const disabled = saving || !selectedBudgetId || !selectedAccountId

  async function handleNext() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 3,
          settings: {
            YNAB_BUDGET_ID: selectedBudgetId,
            YNAB_ACCOUNT_ID: selectedAccountId,
          },
        }),
      })
      const data = await res.json() as { success?: boolean; nextStep?: number; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to save. Please try again.')
        setSaving(false)
        return
      }
      const next = data.nextStep ?? 4
      router.push(next >= 7 ? '/setup/done' : `/setup/${next}`)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={S.card}>
      <p style={S.stepLabel}>Step 3 of 6</p>
      <h1 style={S.heading}>YNAB Budget &amp; Account</h1>
      <p style={S.why}>
        Tell the app which YNAB budget and account to create transactions in.
      </p>

      <div style={S.fieldRow}>
        <label style={S.label} htmlFor="budget">Budget</label>
        <select
          id="budget"
          value={selectedBudgetId}
          onChange={(e) => void handleBudgetChange(e.target.value)}
          style={S.select}
          disabled={loadingBudgets || saving}
        >
          <option value="">
            {loadingBudgets ? 'Loading budgets...' : 'Select a budget'}
          </option>
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div style={S.fieldRow}>
        <label style={S.label} htmlFor="account">Account</label>
        <select
          id="account"
          value={selectedAccountId}
          onChange={(e) => { setSelectedAccountId(e.target.value); setError('') }}
          style={S.select}
          disabled={loadingAccounts || !selectedBudgetId || saving}
        >
          <option value="">
            {loadingAccounts
              ? 'Loading accounts...'
              : !selectedBudgetId
                ? 'Select a budget first'
                : 'Select an account'}
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {error && <div style={S.errorMsg}>{error}</div>}

      <div style={S.actions}>
        <button
          onClick={() => router.push('/setup/2')}
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
