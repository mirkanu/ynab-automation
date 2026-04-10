'use client'

import { useState, useEffect, useCallback } from 'react'

interface Budget {
  id: string
  name: string
}

interface Account {
  id: string
  name: string
}

interface Props {
  onConnectionChange?: (connected: boolean, budgetId: string | null) => void
}

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
  errorMsg: {
    fontSize: '0.8125rem',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.5rem 0.875rem',
    marginTop: '0.75rem',
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
  divider: {
    borderTop: '1px solid #f3f4f6',
    margin: '1.25rem 0',
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

export default function YnabConnectionSection({ onConnectionChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [pat, setPat] = useState('')
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedBudgetId, setSelectedBudgetId] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [savingPat, setSavingPat] = useState(false)
  const [savingSelection, setSavingSelection] = useState(false)
  const [patSaved, setPatSaved] = useState(false)
  const [selectionSaved, setSelectionSaved] = useState(false)
  const [loadingBudgets, setLoadingBudgets] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [error, setError] = useState('')

  const fetchBudgets = useCallback(async () => {
    setLoadingBudgets(true)
    try {
      const res = await fetch('/api/ynab/budgets')
      if (res.ok) {
        const data = await res.json() as { budgets: Budget[] }
        setBudgets(data.budgets)
      }
    } catch {
      // Non-critical — leave budgets empty
    } finally {
      setLoadingBudgets(false)
    }
  }, [])

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
    async function init() {
      setLoading(true)
      try {
        const res = await fetch('/api/ynab/status')
        if (res.ok) {
          const status = await res.json() as { connected: boolean; budgetId: string | null; accountId: string | null }
          if (status.connected) {
            if (status.budgetId) setSelectedBudgetId(status.budgetId)
            if (status.accountId) setSelectedAccountId(status.accountId)
            await fetchBudgets()
            if (status.budgetId) {
              await fetchAccounts(status.budgetId)
            }
          }
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [fetchBudgets, fetchAccounts])

  const handleSavePat = async () => {
    if (!pat.trim()) {
      setError('Please enter a YNAB Personal Access Token.')
      return
    }
    setSavingPat(true)
    setError('')
    setPatSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { YNAB_ACCESS_TOKEN: pat.trim() } }),
      })
      if (!res.ok) {
        setError('Failed to save token. Please try again.')
        return
      }
      setPatSaved(true)
      await fetchBudgets()
      onConnectionChange?.(true, selectedBudgetId || null)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingPat(false)
    }
  }

  const handleBudgetChange = async (budgetId: string) => {
    setSelectedBudgetId(budgetId)
    setSelectedAccountId('')
    setAccounts([])
    if (budgetId) {
      await fetchAccounts(budgetId)
    }
  }

  const handleSaveSelection = async () => {
    if (!selectedBudgetId || !selectedAccountId) {
      setError('Please select both a budget and an account.')
      return
    }
    setSavingSelection(true)
    setError('')
    setSelectionSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            YNAB_BUDGET_ID: selectedBudgetId,
            YNAB_ACCOUNT_ID: selectedAccountId,
          },
        }),
      })
      if (!res.ok) {
        setError('Failed to save selection. Please try again.')
        return
      }
      setSelectionSaved(true)
      onConnectionChange?.(true, selectedBudgetId)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingSelection(false)
    }
  }

  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>YNAB Connection</h2>
      <p style={S.sectionDesc}>
        Connect your YNAB account using a Personal Access Token. Budgets and accounts populate live — no redeploy required.
      </p>

      {loading ? (
        <p style={S.hint}>Loading YNAB configuration...</p>
      ) : (
        <>
          {/* PAT input */}
          <div style={S.fieldRow}>
            <label style={S.label} htmlFor="ynab-pat">Personal Access Token</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="ynab-pat"
                type="password"
                placeholder="Paste your YNAB Personal Access Token"
                value={pat}
                onChange={(e) => { setPat(e.target.value); setError(''); setPatSaved(false) }}
                style={{ ...S.input, flex: 1 }}
                disabled={savingPat}
                autoComplete="off"
              />
              <button
                onClick={() => void handleSavePat()}
                disabled={savingPat || !pat.trim()}
                style={{
                  ...S.btnPrimary,
                  opacity: savingPat || !pat.trim() ? 0.7 : 1,
                  cursor: savingPat || !pat.trim() ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {savingPat ? (
                  <>
                    <span style={S.spinner} />
                    Saving...
                  </>
                ) : (
                  'Save Token'
                )}
              </button>
            </div>
            <p style={S.hint}>Get your token at ynab.com/settings/developer</p>
          </div>

          {patSaved && (
            <div style={S.successMsg}>
              Token saved — select your budget below.
            </div>
          )}

          {budgets.length > 0 && (
            <>
              <div style={S.divider} />

              {/* Budget dropdown */}
              <div style={S.fieldRow}>
                <label style={S.label} htmlFor="ynab-budget">Budget</label>
                <select
                  id="ynab-budget"
                  value={selectedBudgetId}
                  onChange={(e) => void handleBudgetChange(e.target.value)}
                  style={S.select}
                  disabled={loadingBudgets}
                >
                  <option value="">{loadingBudgets ? 'Loading budgets...' : 'Select a budget'}</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Account dropdown */}
              <div style={S.fieldRow}>
                <label style={S.label} htmlFor="ynab-account">Account</label>
                <select
                  id="ynab-account"
                  value={selectedAccountId}
                  onChange={(e) => { setSelectedAccountId(e.target.value); setSelectionSaved(false) }}
                  style={S.select}
                  disabled={loadingAccounts || !selectedBudgetId}
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

              <button
                onClick={() => void handleSaveSelection()}
                disabled={savingSelection || !selectedBudgetId || !selectedAccountId}
                style={{
                  ...S.btnPrimary,
                  opacity: savingSelection || !selectedBudgetId || !selectedAccountId ? 0.7 : 1,
                  cursor: savingSelection || !selectedBudgetId || !selectedAccountId ? 'not-allowed' : 'pointer',
                }}
              >
                {savingSelection ? (
                  <>
                    <span style={S.spinner} />
                    Saving...
                  </>
                ) : (
                  'Save Budget & Account'
                )}
              </button>

              {selectionSaved && (
                <div style={S.successMsg}>
                  Budget and account saved.
                </div>
              )}
            </>
          )}

          {!budgets.length && !patSaved && (
            <p style={{ ...S.hint, marginTop: '0.5rem' }}>
              Enter your YNAB Personal Access Token above and click Save Token to load your budgets.
            </p>
          )}

          {error && <div style={S.errorMsg}>{error}</div>}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
