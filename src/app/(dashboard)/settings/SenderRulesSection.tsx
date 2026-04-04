'use client';

import { useState, useEffect, useCallback } from 'react';

interface SenderRule {
  email: string;
  name: string;
  accountId: string;
  accountName: string;
  budgetId: string;
}

interface YnabAccount {
  id: string;
  name: string;
}

interface Props {
  connected: boolean;
  initialBudgetId?: string | null;
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
  errorMsg: {
    fontSize: '0.8125rem',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.5rem 0.875rem',
    marginTop: '0.75rem',
  },
  ruleRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '0.5rem 0',
    borderBottom: '1px solid #f3f4f6',
  },
  ruleLabel: {
    fontSize: '0.875rem',
    color: '#374151',
  },
  ruleArrow: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    margin: '0 0.5rem',
  },
  noRules: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    fontStyle: 'italic' as const,
    marginBottom: '1rem',
  },
  addForm: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #f3f4f6',
  },
  addFormTitle: {
    fontSize: '0.875rem',
    fontWeight: 600 as const,
    color: '#374151',
    marginBottom: '0.75rem',
  },
};

export default function SenderRulesSection({ connected, initialBudgetId }: Props) {
  const [rules, setRules] = useState<SenderRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newBudgetId] = useState(initialBudgetId ?? '');
  const [accounts, setAccounts] = useState<YnabAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [newAccountId, setNewAccountId] = useState('');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/sender-rules');
      if (res.ok) {
        const data = await res.json() as { rules: SenderRule[] };
        setRules(data.rules);
      }
    } catch {
      // Non-critical — leave rules empty
    } finally {
      setLoading(false);
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
    void fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (newBudgetId) {
      void fetchAccounts(newBudgetId);
    }
  }, [newBudgetId, fetchAccounts]);

  const saveRules = async (updated: SenderRule[]) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings/sender-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated }),
      });
      if (res.ok) {
        setRules(updated);
      } else {
        setError('Failed to save rules. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async () => {
    if (!newEmail.trim() || !newAccountId) {
      setError('Sender email and account are required.');
      return;
    }
    const selectedAccount = accounts.find((a) => a.id === newAccountId);
    const newRule: SenderRule = {
      email: newEmail.trim(),
      name: newName.trim(),
      accountId: newAccountId,
      accountName: selectedAccount?.name ?? '',
      budgetId: newBudgetId,
    };
    await saveRules([...rules, newRule]);
    setNewEmail('');
    setNewName('');
    setNewAccountId('');
  };

  const handleDeleteRule = async (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    await saveRules(updated);
  };

  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>Sender Routing Rules</h2>
      <p style={S.sectionDesc}>
        Route emails from specific senders to different YNAB accounts. Overrides your default account.
      </p>

      {!connected ? (
        <p style={{ ...S.hint, color: '#9ca3af' }}>Connect YNAB first to configure sender rules.</p>
      ) : (
        <>
          {loading ? (
            <p style={S.hint}>Loading rules...</p>
          ) : rules.length === 0 ? (
            <p style={S.noRules}>No rules yet.</p>
          ) : (
            <div style={{ marginBottom: '0.5rem' }}>
              {rules.map((rule, i) => (
                <div key={i} style={S.ruleRow}>
                  <span style={S.ruleLabel}>
                    {rule.name ? `${rule.name} (${rule.email})` : rule.email}
                    <span style={S.ruleArrow}> → </span>
                    {rule.accountName}
                  </span>
                  <button
                    onClick={() => void handleDeleteRule(i)}
                    disabled={saving}
                    style={{ ...S.btnDanger, opacity: saving ? 0.5 : 1 }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={S.addForm}>
            <p style={S.addFormTitle}>Add Rule</p>

            {!newBudgetId ? (
              <p style={S.hint}>Select a default budget above before adding sender rules.</p>
            ) : (
              <>
                <div style={S.fieldRow}>
                  <label style={S.label} htmlFor="sender-email">Sender email</label>
                  <input
                    id="sender-email"
                    type="email"
                    placeholder="sender@example.com"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setError(''); }}
                    style={S.input}
                  />
                </div>

                <div style={S.fieldRow}>
                  <label style={S.label} htmlFor="sender-name">Sender name (optional)</label>
                  <input
                    id="sender-name"
                    type="text"
                    placeholder="e.g. Family member"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={S.input}
                  />
                </div>

                <div style={S.fieldRow}>
                  <label style={S.label} htmlFor="sender-account">Account</label>
                  <select
                    id="sender-account"
                    value={newAccountId}
                    onChange={(e) => { setNewAccountId(e.target.value); setError(''); }}
                    style={S.select}
                    disabled={loadingAccounts}
                  >
                    <option value="">{loadingAccounts ? 'Loading accounts...' : 'Select an account'}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => void handleAddRule()}
                  disabled={saving}
                  style={{
                    ...S.btnPrimary,
                    opacity: saving ? 0.7 : 1,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Add Rule'}
                </button>
              </>
            )}
          </div>

          {error && <div style={S.errorMsg}>{error}</div>}
        </>
      )}
    </div>
  );
}
