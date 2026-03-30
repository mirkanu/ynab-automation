'use client';
import { useState, useEffect, useCallback } from 'react';

// -- Types ------------------------------------------------------------------

interface Sender {
  email: string;
  name: string;
  accountId: string;
}

interface CurrencyRoute {
  currency: string;
  accountId: string;
}

interface YnabBudget { id: string; name: string; }
interface YnabAccount { id: string; name: string; type: string; closed: boolean; }

interface SettingsFormProps {
  currentSenders: Array<{ email: string; name: string; accountId: string }>;
  currentCurrencyAccounts: Record<string, string>;
  currentApiKeys: {
    anthropicKey: string;
    resendKey: string;
    railwayToken: string;
  };
  currentOther: {
    adminEmail: string;
    inboundEmail: string;
    budgetId: string;
    testMode: boolean;
  };
}

type SaveStatus = 'idle' | 'loading' | 'success' | 'error';

// -- Styles (matching SetupWizard patterns) ---------------------------------

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
  hint: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
    lineHeight: 1.4,
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
  btnPrimary: {
    display: 'inline-block' as const,
    padding: '0.5625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600 as const,
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  btnGhost: {
    fontSize: '0.8125rem',
    color: '#2563eb',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem 0',
  },
  btnDanger: {
    fontSize: '0.8125rem',
    color: '#dc2626',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem 0',
  },
  senderBox: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '0.75rem',
    backgroundColor: '#fafafa',
  },
  error: {
    fontSize: '0.8125rem',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.625rem 0.875rem',
    margin: '0.75rem 0 0',
  },
  success: {
    fontSize: '0.8125rem',
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '0.625rem 0.875rem',
    margin: '0.75rem 0 0',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #f3f4f6',
    margin: '1.25rem 0',
  },
  fieldRow: {
    marginBottom: '0.625rem',
  },
  memoPreview: {
    fontSize: '0.75rem',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
    marginTop: '0.75rem',
    fontFamily: 'monospace',
  },
  tokenRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.5rem',
  },
  tokenDisplay: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    color: '#374151',
    backgroundColor: '#f9fafb',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  tokenBtn: {
    fontSize: '0.75rem',
    fontWeight: 500 as const,
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    color: '#374151',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
};

// -- Helpers ----------------------------------------------------------------

function blankSender(): Sender {
  return { email: '', name: '', accountId: '' };
}

function toSenderState(
  input: Array<{ email: string; name: string; accountId: string }>
): Sender[] {
  if (!input.length) return [blankSender()];
  return input.map(s => ({
    email: s.email,
    name: s.name,
    accountId: s.accountId,
  }));
}

function toCurrencyRoutes(input: Record<string, string>): CurrencyRoute[] {
  return Object.entries(input).map(([currency, accountId]) => ({ currency, accountId }));
}

function buildSendersJson(senders: Sender[]): string {
  const arr = senders
    .filter(s => s.email.trim() && s.name.trim() && s.accountId.trim())
    .map(s => ({
      email: s.email.trim(),
      name: s.name.trim(),
      accountId: s.accountId.trim(),
    }));
  return JSON.stringify(arr);
}

function buildCurrencyJson(routes: CurrencyRoute[]): string {
  const obj: Record<string, string> = {};
  for (const r of routes) {
    if (r.currency.trim() && r.accountId.trim()) {
      obj[r.currency.trim().toUpperCase()] = r.accountId.trim();
    }
  }
  return JSON.stringify(obj);
}

function maskToken(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 4) + '*'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

// -- Token Field Component --------------------------------------------------

function TokenField({
  label,
  value,
  masked,
  optional,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  masked: string;
  optional?: boolean;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
}) {
  const [mode, setMode] = useState<'display' | 'revealed' | 'editing'>('display');
  const [editValue, setEditValue] = useState('');

  if (mode === 'editing') {
    return (
      <div style={S.fieldRow}>
        <label style={S.label}>
          {label}
          {optional && <span style={{ fontWeight: 400, color: '#9ca3af' }}> (optional)</span>}
        </label>
        <div style={S.tokenRow}>
          <input
            style={{ ...S.input, flex: 1 }}
            type="text"
            placeholder="Paste new value"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            autoFocus
          />
          <button
            style={S.tokenBtn}
            onClick={() => {
              if (editValue.trim()) onChange(editValue.trim());
              setEditValue('');
              setMode('display');
            }}
          >
            Save
          </button>
          <button
            style={S.tokenBtn}
            onClick={() => { setEditValue(''); setMode('display'); }}
          >
            Cancel
          </button>
        </div>
        {hint && <p style={S.hint}>{hint}</p>}
      </div>
    );
  }

  return (
    <div style={S.fieldRow}>
      <label style={S.label}>
        {label}
        {optional && <span style={{ fontWeight: 400, color: '#9ca3af' }}> (optional)</span>}
      </label>
      <div style={S.tokenRow}>
        <div style={S.tokenDisplay}>
          {value ? (mode === 'revealed' ? value : masked) : <span style={{ color: '#9ca3af' }}>Not set</span>}
        </div>
        {value && (
          <button
            style={S.tokenBtn}
            onClick={() => setMode(mode === 'revealed' ? 'display' : 'revealed')}
          >
            {mode === 'revealed' ? 'Hide' : 'Show'}
          </button>
        )}
        <button style={S.tokenBtn} onClick={() => { setEditValue(''); setMode('editing'); }}>
          Edit
        </button>
      </div>
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  );
}

// -- Component --------------------------------------------------------------

export default function SettingsForm({
  currentSenders,
  currentCurrencyAccounts,
  currentApiKeys,
  currentOther,
}: SettingsFormProps) {
  // Senders state
  const [senders, setSenders] = useState<Sender[]>(toSenderState(currentSenders));

  // Currency routes state
  const [currencyRoutes, setCurrencyRoutes] = useState<CurrencyRoute[]>(
    toCurrencyRoutes(currentCurrencyAccounts)
  );

  // API keys state — store pending edits only (empty = keep current)
  const [pendingKeys, setPendingKeys] = useState<Record<string, string>>({});

  // Other settings state
  const [adminEmail, setAdminEmail] = useState(currentOther.adminEmail);
  const [inboundEmail, setInboundEmail] = useState(currentOther.inboundEmail);
  const [budgetId, setBudgetId] = useState(currentOther.budgetId);
  const [testMode, setTestMode] = useState(currentOther.testMode);

  // YNAB data for dropdowns
  const [budgets, setBudgets] = useState<YnabBudget[]>([]);
  const [accounts, setAccounts] = useState<YnabAccount[]>([]);
  const [ynabLoading, setYnabLoading] = useState(false);
  const [ynabError, setYnabError] = useState('');

  // Save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');

  // The effective Railway token (pending edit or current)
  const effectiveRailwayToken = pendingKeys.railwayToken || currentApiKeys.railwayToken;

  async function handleBudgetChange(newBudgetId: string) {
    setBudgetId(newBudgetId);
  }

  // Helper: get account name from ID
  function accountName(id: string): string {
    const acct = accounts.find(a => a.id === id);
    return acct ? acct.name : '';
  }

  // -- Sender helpers -------------------------------------------------------

  function updateSender(i: number, field: keyof Sender, value: string) {
    setSenders(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }
  function addSender() {
    setSenders(prev => [...prev, blankSender()]);
  }
  function removeSender(i: number) {
    setSenders(prev => prev.filter((_, idx) => idx !== i));
  }

  // -- Currency helpers -----------------------------------------------------

  function addCurrencyRoute() {
    setCurrencyRoutes(prev => [...prev, { currency: '', accountId: '' }]);
  }
  function updateCurrencyRoute(i: number, field: keyof CurrencyRoute, value: string) {
    setCurrencyRoutes(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function removeCurrencyRoute(i: number) {
    setCurrencyRoutes(prev => prev.filter((_, idx) => idx !== i));
  }

  // -- Save handler ---------------------------------------------------------

  function buildVariables(): Record<string, string> {
    const variables: Record<string, string> = {
      SENDERS: buildSendersJson(senders),
      ADMIN_EMAIL: adminEmail.trim(),
      INBOUND_EMAIL: inboundEmail.trim(),
      YNAB_BUDGET_ID: budgetId.trim(),
      TEST_MODE: testMode ? 'true' : 'false',
    };

    // Only include API keys if user provided a new value
    if (pendingKeys.anthropicKey) variables.ANTHROPIC_API_KEY = pendingKeys.anthropicKey;
    if (pendingKeys.resendKey) variables.RESEND_API_KEY = pendingKeys.resendKey;
    if (pendingKeys.railwayToken) variables.RAILWAY_API_TOKEN = pendingKeys.railwayToken;

    // Currency accounts
    const currencyJson = buildCurrencyJson(currencyRoutes);
    if (currencyJson !== '{}') variables.CURRENCY_ACCOUNTS = currencyJson;

    return variables;
  }

  async function saveSettings() {
    setSaveStatus('loading');
    setSaveError('');

    const variables = buildVariables();

    try {
      // Save to database (takes effect immediately, no restart)
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: variables }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.error) {
        setSaveError(data.error ?? 'Unknown error');
        setSaveStatus('error');
        return;
      }

      // Also sync to Railway env vars if token is available (for persistence across deploys)
      if (effectiveRailwayToken) {
        try {
          await fetch('/api/setup/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ railwayToken: effectiveRailwayToken, variables }),
          });
        } catch {
          // Railway sync failure is non-fatal — DB save already succeeded
        }
      }

      setSaveStatus('success');
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveStatus('error');
    }
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div>
      {/* YNAB connection status */}
      {ynabLoading && (
        <div style={{ ...S.section, padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
          Loading YNAB budgets and accounts...
        </div>
      )}
      {ynabError && <div style={{ ...S.error, marginBottom: '1rem' }}>YNAB: {ynabError}</div>}

      {/* Section 1: Sender Routing */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Sender Routing</h2>
        <p style={S.sectionDesc}>
          Each sender forwards order emails from their email address. Transactions land in their assigned YNAB account.
        </p>

        {senders.map((s, i) => (
          <div key={i} style={S.senderBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                Sender {i + 1}
              </span>
              {senders.length > 1 && (
                <button style={S.btnDanger} onClick={() => removeSender(i)}>
                  Remove
                </button>
              )}
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>Email address</label>
              <input
                style={S.input}
                type="email"
                placeholder="their@email.com"
                value={s.email}
                onChange={e => updateSender(i, 'email', e.target.value)}
              />
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>Display name</label>
              <input
                style={S.input}
                type="text"
                placeholder="Alice"
                value={s.name}
                onChange={e => updateSender(i, 'name', e.target.value)}
              />
              <p style={S.hint}>Used in error notifications and YNAB memo</p>
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>YNAB Account</label>
              {accounts.length > 0 ? (
                <select
                  style={S.select}
                  value={s.accountId}
                  onChange={e => updateSender(i, 'accountId', e.target.value)}
                >
                  <option value="">— select account —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : (
                <input
                  style={S.input}
                  type="text"
                  placeholder="Account ID (connect YNAB above for dropdown)"
                  value={s.accountId}
                  onChange={e => updateSender(i, 'accountId', e.target.value)}
                />
              )}
            </div>

            {/* Memo preview */}
            <div style={S.memoPreview}>
              YNAB memo: {s.name || '(name)'}: (item description) - Automatically added from email
              {s.accountId && accountName(s.accountId) && (
                <span style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af' }}>
                  Account: {accountName(s.accountId)}
                </span>
              )}
            </div>
          </div>
        ))}

        <button style={S.btnGhost} onClick={addSender}>
          + Add sender
        </button>
      </div>

      {/* Section 2: Currency Routing */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Currency Routing</h2>
        <p style={S.sectionDesc}>
          Route transactions in a specific currency to a dedicated YNAB account (e.g. a Euro account).
        </p>

        {currencyRoutes.map((r, i) => (
          <div
            key={i}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}
          >
            <input
              style={{ ...S.input, width: '100px', flex: 'none' }}
              placeholder="EUR"
              value={r.currency}
              onChange={e => updateCurrencyRoute(i, 'currency', e.target.value)}
            />
            {accounts.length > 0 ? (
              <select
                style={S.select}
                value={r.accountId}
                onChange={e => updateCurrencyRoute(i, 'accountId', e.target.value)}
              >
                <option value="">— select account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <input
                style={S.input}
                placeholder="Account ID"
                value={r.accountId}
                onChange={e => updateCurrencyRoute(i, 'accountId', e.target.value)}
              />
            )}
            <button
              style={{ ...S.btnDanger, flexShrink: 0 }}
              onClick={() => removeCurrencyRoute(i)}
            >
              Remove
            </button>
          </div>
        ))}

        <button style={S.btnGhost} onClick={addCurrencyRoute}>
          + Add currency route
        </button>
      </div>

      {/* Section 3: API Keys & Tokens */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>API Keys &amp; Tokens</h2>
        <p style={S.sectionDesc}>
          Tokens are stored securely as Railway environment variables. Click Edit to change a value.
        </p>

        <TokenField
          label="Anthropic API Key"
          value={pendingKeys.anthropicKey || currentApiKeys.anthropicKey}
          masked={maskToken(pendingKeys.anthropicKey || currentApiKeys.anthropicKey)}
          onChange={v => setPendingKeys(prev => ({ ...prev, anthropicKey: v }))}
          hint={<>Get yours at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>console.anthropic.com</a></>}
        />

        <TokenField
          label="Resend API Key"
          value={pendingKeys.resendKey || currentApiKeys.resendKey}
          masked={maskToken(pendingKeys.resendKey || currentApiKeys.resendKey)}
          optional
          onChange={v => setPendingKeys(prev => ({ ...prev, resendKey: v }))}
          hint={<>Get yours at <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>resend.com/api-keys</a></>}
        />

        <TokenField
          label="Railway API Token"
          value={pendingKeys.railwayToken || currentApiKeys.railwayToken}
          masked={maskToken(pendingKeys.railwayToken || currentApiKeys.railwayToken)}
          onChange={v => setPendingKeys(prev => ({ ...prev, railwayToken: v }))}
          hint={<>Stored permanently for saving settings. Generate at <a href="https://railway.app/account/tokens" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>railway.app/account/tokens</a></>}
        />
      </div>

      {/* Section 4: Other Settings */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Other Settings</h2>
        <p style={S.sectionDesc}>General configuration for the automation.</p>

        <div style={{
          ...S.fieldRow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: testMode ? '#dbeafe' : '#f9fafb',
          border: `1px solid ${testMode ? '#93c5fd' : '#e5e7eb'}`,
          borderRadius: '8px',
          marginBottom: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: testMode ? '#1e40af' : '#374151' }}>
              Test Mode
            </div>
            <div style={{ fontSize: '0.75rem', color: testMode ? '#1e40af' : '#6b7280', marginTop: '0.125rem' }}>
              {testMode
                ? 'Emails are parsed but NOT written to YNAB'
                : 'Emails are processed and written to YNAB normally'}
            </div>
          </div>
          <button
            onClick={() => setTestMode(!testMode)}
            style={{
              position: 'relative' as const,
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: testMode ? '#2563eb' : '#d1d5db',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute' as const,
              top: '2px',
              left: testMode ? '22px' : '2px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>Admin Email</label>
          <input
            style={S.input}
            type="email"
            placeholder="you@example.com"
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
          />
          <p style={S.hint}>Where error notifications are sent</p>
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>Inbound Email</label>
          <input
            style={S.input}
            type="email"
            placeholder="inbound@yourdomain.com"
            value={inboundEmail}
            onChange={e => setInboundEmail(e.target.value)}
          />
          <p style={S.hint}>The email address that receives forwarded order emails</p>
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>YNAB Budget</label>
          {budgets.length > 0 ? (
            <select
              style={S.select}
              value={budgetId}
              onChange={e => handleBudgetChange(e.target.value)}
            >
              <option value="">— select budget —</option>
              {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : (
            <input
              style={S.input}
              type="text"
              placeholder="Budget ID (connect YNAB above for dropdown)"
              value={budgetId}
              onChange={e => setBudgetId(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Save */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Save Settings</h2>
        <p style={S.sectionDesc}>
          Changes take effect immediately — no restart required.
          {effectiveRailwayToken
            ? ' Settings are also synced to Railway env vars for persistence across deploys.'
            : ' Add a Railway API token above to also persist settings across deploys.'}
        </p>

        <button
          style={{
            ...S.btnPrimary,
            opacity: saveStatus === 'loading' ? 0.6 : 1,
          }}
          onClick={saveSettings}
          disabled={saveStatus === 'loading'}
        >
          {saveStatus === 'loading' ? 'Saving...' : 'Save Settings'}
        </button>

        {saveStatus === 'error' && <div style={S.error}>{saveError}</div>}
        {saveStatus === 'success' && (
          <div style={S.success}>
            Settings saved — changes are live now.
            {!effectiveRailwayToken && ' Note: add a Railway API token to persist across deploys.'}
          </div>
        )}
      </div>
    </div>
  );
}
