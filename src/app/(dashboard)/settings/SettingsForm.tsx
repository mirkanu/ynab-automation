'use client';
import { useState } from 'react';

// -- Types ------------------------------------------------------------------

interface Sender {
  email: string;
  name: string;
  accountId: string;
  notificationLabel: string;
}

interface CurrencyRoute {
  currency: string;
  accountId: string;
}

interface SettingsFormProps {
  currentSenders: Array<{ email: string; name: string; accountId: string; notificationLabel?: string }>;
  currentCurrencyAccounts: Record<string, string>;
  currentApiKeys: {
    anthropicKey: string;
    ynabToken: string;
    resendKey: string;
  };
  currentOther: {
    adminEmail: string;
    inboundEmail: string;
    budgetId: string;
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
  btnSecondary: {
    display: 'inline-block' as const,
    padding: '0.5625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500 as const,
    backgroundColor: '#f3f4f6',
    color: '#374151',
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
};

// -- Helpers ----------------------------------------------------------------

function blankSender(): Sender {
  return { email: '', name: '', accountId: '', notificationLabel: '' };
}

function toSenderState(
  input: Array<{ email: string; name: string; accountId: string; notificationLabel?: string }>
): Sender[] {
  if (!input.length) return [blankSender()];
  return input.map(s => ({
    email: s.email,
    name: s.name,
    accountId: s.accountId,
    notificationLabel: s.notificationLabel ?? '',
  }));
}

function toCurrencyRoutes(input: Record<string, string>): CurrencyRoute[] {
  const entries = Object.entries(input);
  return entries.map(([currency, accountId]) => ({ currency, accountId }));
}

function buildSendersJson(senders: Sender[]): string {
  const arr = senders
    .filter(s => s.email.trim() && s.name.trim() && s.accountId.trim())
    .map(s => {
      const obj: Record<string, string> = { email: s.email.trim(), name: s.name.trim(), accountId: s.accountId.trim() };
      if (s.notificationLabel.trim()) obj.notificationLabel = s.notificationLabel.trim();
      return obj;
    });
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

// -- Mask helper for API keys -----------------------------------------------

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
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

  // API keys state (start with masked placeholders; user types new value to replace)
  const [anthropicKey, setAnthropicKey] = useState('');
  const [ynabToken, setYnabToken] = useState('');
  const [resendKey, setResendKey] = useState('');

  // Other settings state
  const [adminEmail, setAdminEmail] = useState(currentOther.adminEmail);
  const [inboundEmail, setInboundEmail] = useState(currentOther.inboundEmail);
  const [budgetId, setBudgetId] = useState(currentOther.budgetId);

  // Save state
  const [railwayToken, setRailwayToken] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');

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

  async function saveToRailway() {
    setSaveStatus('loading');
    setSaveError('');

    const variables: Record<string, string> = {
      SENDERS: buildSendersJson(senders),
      ADMIN_EMAIL: adminEmail.trim(),
      INBOUND_EMAIL: inboundEmail.trim(),
      YNAB_BUDGET_ID: budgetId.trim(),
    };

    // Only include API keys if user typed a new value
    if (anthropicKey.trim()) variables.ANTHROPIC_API_KEY = anthropicKey.trim();
    if (ynabToken.trim()) variables.YNAB_PERSONAL_ACCESS_TOKEN = ynabToken.trim();
    if (resendKey.trim()) variables.RESEND_API_KEY = resendKey.trim();

    // Currency accounts
    const currencyJson = buildCurrencyJson(currencyRoutes);
    if (currencyJson !== '{}') variables.CURRENCY_ACCOUNTS = currencyJson;

    try {
      const res = await fetch('/api/setup/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ railwayToken, variables }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.error) {
        setSaveError(data.error ?? 'Unknown error');
        setSaveStatus('error');
      } else {
        setSaveStatus('success');
      }
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveStatus('error');
    }
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div>
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
            </div>

            <div style={S.fieldRow}>
              <label style={S.label}>YNAB Account ID</label>
              <input
                style={S.input}
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={s.accountId}
                onChange={e => updateSender(i, 'accountId', e.target.value)}
              />
            </div>

            <div>
              <label style={S.label}>
                Notification label{' '}
                <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
              </label>
              <input
                style={S.input}
                type="text"
                placeholder="Alice"
                value={s.notificationLabel}
                onChange={e => updateSender(i, 'notificationLabel', e.target.value)}
              />
              <p style={S.hint}>
                Appended to error notification subjects, e.g. &quot;failed to parse order email (Alice)&quot;
              </p>
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
            <input
              style={S.input}
              placeholder="YNAB Account ID"
              value={r.accountId}
              onChange={e => updateCurrencyRoute(i, 'accountId', e.target.value)}
            />
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

      {/* Section 3: API Keys */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>API Keys</h2>
        <p style={S.sectionDesc}>
          Leave a field blank to keep the current value. Enter a new value to replace it.
        </p>

        <div style={S.fieldRow}>
          <label style={S.label}>Anthropic API Key</label>
          <input
            style={S.input}
            type="password"
            placeholder={currentApiKeys.anthropicKey ? maskKey(currentApiKeys.anthropicKey) : 'sk-ant-...'}
            value={anthropicKey}
            onChange={e => setAnthropicKey(e.target.value)}
          />
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>YNAB Personal Access Token</label>
          <input
            style={S.input}
            type="password"
            placeholder={currentApiKeys.ynabToken ? maskKey(currentApiKeys.ynabToken) : 'Paste token'}
            value={ynabToken}
            onChange={e => setYnabToken(e.target.value)}
          />
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>
            Resend API Key{' '}
            <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
          </label>
          <input
            style={S.input}
            type="password"
            placeholder={currentApiKeys.resendKey ? maskKey(currentApiKeys.resendKey) : 're_...'}
            value={resendKey}
            onChange={e => setResendKey(e.target.value)}
          />
        </div>
      </div>

      {/* Section 4: Other Settings */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Other Settings</h2>
        <p style={S.sectionDesc}>General configuration for the automation.</p>

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
          <label style={S.label}>YNAB Budget ID</label>
          <input
            style={S.input}
            type="text"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={budgetId}
            onChange={e => setBudgetId(e.target.value)}
          />
        </div>
      </div>

      {/* Save to Railway */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Save to Railway</h2>
        <p style={S.sectionDesc}>
          Enter your Railway API token to apply the settings above. The token is not stored — you enter it each time.
          Railway will redeploy the service automatically after saving.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={S.label}>Railway API Token</label>
          <input
            style={S.input}
            type="password"
            placeholder="Paste your Railway API token"
            value={railwayToken}
            onChange={e => {
              setRailwayToken(e.target.value);
              setSaveStatus('idle');
              setSaveError('');
            }}
          />
          <p style={S.hint}>
            Generate at{' '}
            <a
              href="https://railway.app/account/tokens"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2563eb' }}
            >
              railway.app/account/tokens
            </a>
          </p>
        </div>

        <button
          style={{
            ...S.btnPrimary,
            opacity: !railwayToken.trim() || saveStatus === 'loading' ? 0.6 : 1,
          }}
          onClick={saveToRailway}
          disabled={!railwayToken.trim() || saveStatus === 'loading'}
        >
          {saveStatus === 'loading' ? 'Saving...' : 'Save to Railway'}
        </button>

        {saveStatus === 'error' && <div style={S.error}>{saveError}</div>}
        {saveStatus === 'success' && (
          <div style={S.success}>
            Settings saved successfully. The app will restart in a few seconds.
          </div>
        )}
      </div>
    </div>
  );
}
