'use client';

import { useState, useEffect, useCallback } from 'react';

interface YnabBudget {
  id: string;
  name: string;
}

interface YnabAccount {
  id: string;
  name: string;
}

interface Props {
  connected: boolean;
  initialBudgetId?: string | null;
  initialAccountId?: string | null;
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
    textDecoration: 'none',
    transition: 'opacity 0.15s, transform 0.1s',
  },
  btnDanger: {
    fontSize: '0.8125rem',
    color: '#dc2626',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem 0',
  },
  connectedBadge: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '0.375rem',
    fontSize: '0.8125rem',
    fontWeight: 600 as const,
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '999px',
    padding: '0.25rem 0.75rem',
    marginBottom: '1.25rem',
  },
  savedBadge: {
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
};

export default function YnabConnectionSection({ connected, initialBudgetId, initialAccountId }: Props) {
  const [budgets, setBudgets] = useState<YnabBudget[]>([]);
  const [accounts, setAccounts] = useState<YnabAccount[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState(initialBudgetId ?? '');
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId ?? '');
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchBudgets = useCallback(async () => {
    setLoadingBudgets(true);
    try {
      const res = await fetch('/api/ynab/budgets');
      if (res.ok) {
        const data = await res.json() as { budgets: YnabBudget[] };
        setBudgets(data.budgets);
      }
    } finally {
      setLoadingBudgets(false);
    }
  }, []);

  const fetchAccounts = useCallback(async (budgetId: string) => {
    if (!budgetId) {
      setAccounts([]);
      return;
    }
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/ynab/budgets/${budgetId}/accounts`);
      if (res.ok) {
        const data = await res.json() as { accounts: YnabAccount[] };
        setAccounts(data.accounts);
      }
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      void fetchBudgets();
    }
  }, [connected, fetchBudgets]);

  useEffect(() => {
    if (selectedBudgetId) {
      void fetchAccounts(selectedBudgetId);
    }
  }, [selectedBudgetId, fetchAccounts]);

  const handleBudgetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBudgetId(e.target.value);
    setSelectedAccountId('');
    setSavedMsg('');
    setErrorMsg('');
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAccountId(e.target.value);
    setSavedMsg('');
    setErrorMsg('');
  };

  const handleSaveSelection = async () => {
    if (!selectedBudgetId || !selectedAccountId) return;
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/ynab/selection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetId: selectedBudgetId, accountId: selectedAccountId }),
      });
      if (res.ok) {
        setSavedMsg('Selection saved.');
      } else {
        setErrorMsg('Failed to save selection.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/ynab/disconnect', { method: 'POST' });
      window.location.reload();
    } catch {
      setDisconnecting(false);
      setErrorMsg('Failed to disconnect. Please try again.');
    }
  };

  if (!connected) {
    return (
      <div style={S.section}>
        <h2 style={S.sectionTitle}>YNAB Connection</h2>
        <p style={S.sectionDesc}>
          Connect your YNAB account to automatically create transactions from your order emails.
        </p>
        <a
          href="/api/ynab/authorize"
          style={{
            ...S.btnPrimary,
            opacity: connectLoading ? 0.7 : 1,
            transform: connectLoading ? 'scale(0.98)' : 'scale(1)',
          }}
          onClick={() => setConnectLoading(true)}
        >
          {connectLoading ? (
            <>
              <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              Connecting...
            </>
          ) : (
            'Connect YNAB'
          )}
        </a>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>YNAB Connection</h2>
      <p style={S.sectionDesc}>
        Your YNAB account is connected. Select the default budget and account for new transactions.
      </p>

      <div style={S.connectedBadge}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
        Connected
      </div>

      <div style={S.fieldRow}>
        <label style={S.label} htmlFor="ynab-budget">Default Budget</label>
        <select
          id="ynab-budget"
          style={S.select}
          value={selectedBudgetId}
          onChange={handleBudgetChange}
          disabled={loadingBudgets}
        >
          <option value="">{loadingBudgets ? 'Loading budgets...' : 'Select a budget'}</option>
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {selectedBudgetId && (
        <div style={S.fieldRow}>
          <label style={S.label} htmlFor="ynab-account">Default Account</label>
          <select
            id="ynab-account"
            style={S.select}
            value={selectedAccountId}
            onChange={handleAccountChange}
            disabled={loadingAccounts}
          >
            <option value="">{loadingAccounts ? 'Loading accounts...' : 'Select an account'}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p style={S.hint}>Choose the account where Amazon orders will be posted.</p>
        </div>
      )}

      {selectedBudgetId && selectedAccountId && (
        <button
          onClick={() => void handleSaveSelection()}
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
            'Save Selection'
          )}
        </button>
      )}

      {savedMsg && <div style={S.savedBadge}>{savedMsg}</div>}
      {errorMsg && <div style={S.errorMsg}>{errorMsg}</div>}

      <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '1.25rem 0' }} />

      <button
        onClick={() => void handleDisconnect()}
        disabled={disconnecting}
        style={{ ...S.btnDanger, opacity: disconnecting ? 0.7 : 1 }}
      >
        {disconnecting ? 'Disconnecting...' : 'Disconnect YNAB'}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
