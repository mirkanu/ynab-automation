'use client';
import { useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface YnabBudget { id: string; name: string; }
interface YnabAccount { id: string; name: string; type: string; closed: boolean; }

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

type Step = 0 | 1 | 2 | 3 | 4;
type ApplyStatus = 'idle' | 'loading' | 'success' | 'error';

// ── Styles ─────────────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    padding: '2rem 1rem',
    boxSizing: 'border-box' as const,
  },
  card: {
    maxWidth: '560px',
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  h1: { fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.375rem' },
  subtitle: { fontSize: '0.9rem', color: '#6b7280', margin: '0 0 1.75rem', lineHeight: 1.5 },
  label: { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' },
  hint: { fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem', lineHeight: 1.4 },
  input: {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '0.5rem 0.75rem', fontSize: '0.875rem',
    border: '1px solid #d1d5db', borderRadius: '6px',
    outline: 'none', color: '#111827', backgroundColor: '#fff',
  },
  select: {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '0.5rem 0.75rem', fontSize: '0.875rem',
    border: '1px solid #d1d5db', borderRadius: '6px',
    outline: 'none', color: '#111827', backgroundColor: '#fff',
  },
  btnPrimary: {
    display: 'inline-block', padding: '0.5625rem 1.25rem',
    fontSize: '0.875rem', fontWeight: 600,
    backgroundColor: '#2563eb', color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
  },
  btnSecondary: {
    display: 'inline-block', padding: '0.5625rem 1.25rem',
    fontSize: '0.875rem', fontWeight: 500,
    backgroundColor: '#f3f4f6', color: '#374151',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
  },
  btnGhost: {
    fontSize: '0.8125rem', color: '#2563eb', background: 'none',
    border: 'none', cursor: 'pointer', padding: '0.25rem 0',
  },
  btnCopy: {
    flexShrink: 0,
    fontSize: '0.75rem', padding: '0.25rem 0.625rem',
    backgroundColor: '#f3f4f6', color: '#374151',
    border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  error: {
    fontSize: '0.8125rem', color: '#dc2626',
    backgroundColor: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '6px', padding: '0.625rem 0.875rem', margin: '0.75rem 0 0',
  },
  senderBox: {
    border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '1rem', marginBottom: '0.75rem', backgroundColor: '#fafafa',
  },
  codeBlock: {
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontSize: '0.75rem', backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: '6px',
    padding: '0.625rem 0.875rem', wordBreak: 'break-all' as const,
    color: '#111827', margin: 0, flex: 1, minWidth: 0,
    overflowWrap: 'break-word' as const,
  },
  row: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' },
  stepLabel: { fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: '0.25rem' },
  divider: { border: 'none', borderTop: '1px solid #f3f4f6', margin: '1.25rem 0' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function blankSender(): Sender {
  return { email: '', name: '', accountId: '', notificationLabel: '' };
}

function buildSendersJson(senders: Sender[]): string {
  const arr = senders.map(s => {
    const obj: Record<string, string> = { email: s.email, name: s.name, accountId: s.accountId };
    if (s.notificationLabel.trim()) obj.notificationLabel = s.notificationLabel.trim();
    return obj;
  });
  return JSON.stringify(arr);
}

function buildCurrencyJson(routes: CurrencyRoute[]): string {
  const obj: Record<string, string> = {};
  for (const r of routes) {
    if (r.currency.trim() && r.accountId) obj[r.currency.trim().toUpperCase()] = r.accountId;
  }
  return JSON.stringify(obj);
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SetupWizard() {
  const [step, setStep] = useState<Step>(0);

  // YNAB state
  const [ynabToken, setYnabToken] = useState('');
  const [budgets, setBudgets] = useState<YnabBudget[]>([]);
  const [budgetId, setBudgetId] = useState('');
  const [accounts, setAccounts] = useState<YnabAccount[]>([]);
  const [ynabLoading, setYnabLoading] = useState(false);
  const [ynabError, setYnabError] = useState('');

  // Senders state
  const [senders, setSenders] = useState<Sender[]>([blankSender()]);
  const [currencyRoutes, setCurrencyRoutes] = useState<CurrencyRoute[]>([]);
  const [showCurrency, setShowCurrency] = useState(false);

  // Other config
  const [anthropicKey, setAnthropicKey] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [resendKey, setResendKey] = useState('');

  // Apply to Railway
  const [railwayToken, setRailwayToken] = useState('');
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [applyError, setApplyError] = useState('');
  const [showCopyFallback, setShowCopyFallback] = useState(false);

  // Copy feedback
  const [copied, setCopied] = useState<string | null>(null);

  // ── YNAB API ──

  async function connectYnab() {
    setYnabError('');
    setYnabLoading(true);
    try {
      const res = await fetch('https://api.youneedabudget.com/v1/budgets', {
        headers: { Authorization: `Bearer ${ynabToken}` },
      });
      if (!res.ok) throw new Error(`YNAB returned ${res.status} — check your token`);
      const json = await res.json() as { data: { budgets: YnabBudget[] } };
      setBudgets(json.data.budgets);
    } catch (e) {
      setYnabError((e as Error).message);
    } finally {
      setYnabLoading(false);
    }
  }

  async function selectBudget(id: string) {
    setBudgetId(id);
    setYnabError('');
    setYnabLoading(true);
    try {
      const res = await fetch(`https://api.youneedabudget.com/v1/budgets/${id}/accounts`, {
        headers: { Authorization: `Bearer ${ynabToken}` },
      });
      if (!res.ok) throw new Error(`Failed to load accounts: ${res.status}`);
      const json = await res.json() as { data: { accounts: YnabAccount[] } };
      const active = json.data.accounts.filter(a => !a.closed && a.type !== 'tracking');
      setAccounts(active);
    } catch (e) {
      setYnabError((e as Error).message);
    } finally {
      setYnabLoading(false);
    }
  }

  // ── Railway apply ──

  async function applyToRailway() {
    setApplyStatus('loading');
    setApplyError('');

    const variables: Record<string, string> = {
      YNAB_PERSONAL_ACCESS_TOKEN: ynabToken,
      YNAB_BUDGET_ID: budgetId,
      SENDERS: sendersJson,
      ANTHROPIC_API_KEY: anthropicKey,
      ADMIN_EMAIL: adminEmail,
    };
    if (hasCurrency) variables.CURRENCY_ACCOUNTS = currencyJson;
    if (resendKey.trim()) variables.RESEND_API_KEY = resendKey.trim();

    try {
      const res = await fetch('/api/setup/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ railwayToken, variables }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || data.error) {
        setApplyError(data.error ?? 'Unknown error');
        setApplyStatus('error');
      } else {
        setApplyStatus('success');
      }
    } catch (e) {
      setApplyError((e as Error).message);
      setApplyStatus('error');
    }
  }

  // ── Copy to clipboard ──

  async function copyValue(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Sender helpers ──

  function updateSender(i: number, field: keyof Sender, value: string) {
    setSenders(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }
  function addSender() { setSenders(prev => [...prev, blankSender()]); }
  function removeSender(i: number) { setSenders(prev => prev.filter((_, idx) => idx !== i)); }

  // ── Currency helpers ──

  function addCurrencyRoute() { setCurrencyRoutes(prev => [...prev, { currency: '', accountId: '' }]); }
  function updateCurrencyRoute(i: number, field: keyof CurrencyRoute, value: string) {
    setCurrencyRoutes(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function removeCurrencyRoute(i: number) { setCurrencyRoutes(prev => prev.filter((_, idx) => idx !== i)); }

  // ── Validation ──

  function step1Valid() { return budgetId && accounts.length > 0; }
  function step2Valid() { return senders.every(s => s.email.trim() && s.name.trim() && s.accountId); }
  function step3Valid() { return anthropicKey.trim() && adminEmail.trim(); }

  // ── Computed output values ──

  const sendersJson = buildSendersJson(senders);
  const currencyJson = buildCurrencyJson(currencyRoutes.filter(r => r.currency && r.accountId));
  const hasCurrency = currencyRoutes.some(r => r.currency.trim() && r.accountId);

  // ── Step renderers ──

  function renderStep0() {
    return (
      <>
        <div style={S.stepLabel}>Welcome</div>
        <h1 style={S.h1}>Set up YNAB Automation</h1>
        <p style={S.subtitle}>
          This wizard configures the app so forwarded order emails automatically create YNAB transactions.
          It runs entirely in your browser — nothing is sent to any server.
        </p>
        <p style={{ ...S.subtitle, marginBottom: '1.75rem' }}><strong>You&apos;ll need:</strong></p>
        <ul style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, paddingLeft: '1.25rem', margin: '0 0 1.75rem' }}>
          <li>Your <strong>YNAB personal access token</strong> — <a href="https://app.ynab.com/settings/developer" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>app.ynab.com → Account Settings → Developer Settings</a></li>
          <li>An <strong>Anthropic API key</strong> — <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>console.anthropic.com</a></li>
          <li>An <strong>Admin email address</strong> (yours) for error notifications</li>
          <li>A <strong>Railway API token</strong> — <a href="https://railway.app/account/tokens" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>railway.app/account/tokens</a> (to apply settings automatically)</li>
          <li><em>Optional:</em> A <strong>Resend API key</strong> for email error alerts — <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>resend.com</a></li>
        </ul>
        <button style={S.btnPrimary} onClick={() => setStep(1)}>Let&apos;s start →</button>
      </>
    );
  }

  function renderStep1() {
    return (
      <>
        <div style={S.stepLabel}>Step 1 of 3</div>
        <h1 style={S.h1}>Connect to YNAB</h1>
        <p style={S.subtitle}>Enter your YNAB personal access token. It&apos;s used here in your browser only — never sent to this server.</p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={S.label}>YNAB Personal Access Token</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input style={S.input} type="password" placeholder="Paste your token here"
              value={ynabToken} onChange={e => setYnabToken(e.target.value)} />
            <button style={{ ...S.btnPrimary, whiteSpace: 'nowrap' as const }}
              onClick={connectYnab} disabled={!ynabToken.trim() || ynabLoading}>
              {ynabLoading ? '…' : 'Connect'}
            </button>
          </div>
          <p style={S.hint}>
            Find this at <a href="https://app.ynab.com/settings/developer" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>app.ynab.com → Account Settings → Developer Settings</a>
          </p>
          {ynabError && <div style={S.error}>{ynabError}</div>}
        </div>

        {budgets.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={S.label}>Select your budget</label>
            <select style={S.select} value={budgetId} onChange={e => selectBudget(e.target.value)}>
              <option value="">— pick a budget —</option>
              {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {accounts.length > 0 && (
          <div style={{ fontSize: '0.8125rem', color: '#16a34a', marginBottom: '1rem' }}>
            ✓ Loaded {accounts.length} accounts from this budget
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button style={S.btnSecondary} onClick={() => setStep(0)}>← Back</button>
          <button style={S.btnPrimary} onClick={() => setStep(2)} disabled={!step1Valid()}>Next →</button>
        </div>
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <div style={S.stepLabel}>Step 2 of 3</div>
        <h1 style={S.h1}>Configure senders</h1>
        <p style={S.subtitle}>Add everyone who will forward order emails. Each person gets their own YNAB account for transactions.</p>

        {senders.map((s, i) => (
          <div key={i} style={S.senderBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Sender {i + 1}</span>
              {senders.length > 1 && (
                <button style={{ ...S.btnGhost, color: '#dc2626' }} onClick={() => removeSender(i)}>Remove</button>
              )}
            </div>
            <div style={{ marginBottom: '0.625rem' }}>
              <label style={S.label}>Email address</label>
              <input style={S.input} type="email" placeholder="their@email.com"
                value={s.email} onChange={e => updateSender(i, 'email', e.target.value)} />
              <p style={S.hint}>The address they forward from (not the retailer&apos;s address)</p>
            </div>
            <div style={{ marginBottom: '0.625rem' }}>
              <label style={S.label}>Display name</label>
              <input style={S.input} type="text" placeholder="Alice"
                value={s.name} onChange={e => updateSender(i, 'name', e.target.value)} />
            </div>
            <div style={{ marginBottom: '0.625rem' }}>
              <label style={S.label}>YNAB account</label>
              <select style={S.select} value={s.accountId} onChange={e => updateSender(i, 'accountId', e.target.value)}>
                <option value="">— select account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p style={S.hint}>Transactions for this person land in this account</p>
            </div>
            <div>
              <label style={S.label}>Notification label <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
              <input style={S.input} type="text" placeholder="Alice"
                value={s.notificationLabel} onChange={e => updateSender(i, 'notificationLabel', e.target.value)} />
              <p style={S.hint}>Appended to error notification subjects: &quot;failed to parse order email (Alice)&quot;</p>
            </div>
          </div>
        ))}

        <button style={{ ...S.btnGhost, marginBottom: '1.25rem' }} onClick={addSender}>+ Add another sender</button>

        <hr style={S.divider} />

        <div style={{ marginBottom: '1rem' }}>
          {!showCurrency ? (
            <button style={S.btnGhost} onClick={() => { setShowCurrency(true); addCurrencyRoute(); }}>
              + Add currency routing (optional)
            </button>
          ) : (
            <>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Currency routing</div>
              <p style={{ ...S.hint, margin: '0 0 0.75rem' }}>Route transactions in a specific currency to a dedicated account (e.g. a Euro account).</p>
              {currencyRoutes.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input style={{ ...S.input, width: '80px' }} placeholder="EUR"
                    value={r.currency} onChange={e => updateCurrencyRoute(i, 'currency', e.target.value)} />
                  <select style={S.select} value={r.accountId} onChange={e => updateCurrencyRoute(i, 'accountId', e.target.value)}>
                    <option value="">— account —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button style={{ ...S.btnGhost, color: '#dc2626', flexShrink: 0 }} onClick={() => removeCurrencyRoute(i)}>✕</button>
                </div>
              ))}
              <button style={S.btnGhost} onClick={addCurrencyRoute}>+ Add another</button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button style={S.btnSecondary} onClick={() => setStep(1)}>← Back</button>
          <button style={S.btnPrimary} onClick={() => setStep(3)} disabled={!step2Valid()}>Next →</button>
        </div>
      </>
    );
  }

  function renderStep3() {
    return (
      <>
        <div style={S.stepLabel}>Step 3 of 3</div>
        <h1 style={S.h1}>API keys</h1>
        <p style={S.subtitle}>These are entered here only to generate the config values — they never leave your browser.</p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={S.label}>Anthropic API Key</label>
          <input style={S.input} type="password" placeholder="sk-ant-..."
            value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} />
          <p style={S.hint}>From <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>console.anthropic.com</a> → API Keys</p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={S.label}>Admin email</label>
          <input style={S.input} type="email" placeholder="you@example.com"
            value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
          <p style={S.hint}>Where error notifications are sent</p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={S.label}>Resend API Key <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
          <input style={S.input} type="password" placeholder="re_..."
            value={resendKey} onChange={e => setResendKey(e.target.value)} />
          <p style={S.hint}>
            For error notification emails. From <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>resend.com</a>.
            If omitted, error notifications are disabled.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button style={S.btnSecondary} onClick={() => setStep(2)}>← Back</button>
          <button style={S.btnPrimary} onClick={() => setStep(4)} disabled={!step3Valid()}>Next →</button>
        </div>
      </>
    );
  }

  function EnvRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={S.label}>{label}</label>
        <div style={S.row}>
          <pre style={S.codeBlock}>{value}</pre>
          <button style={S.btnCopy} onClick={() => copyValue(label, value)}>
            {copied === label ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        {hint && <p style={S.hint}>{hint}</p>}
      </div>
    );
  }

  function renderStep4() {
    if (applyStatus === 'success') {
      return (
        <>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎉</div>
          <h1 style={S.h1}>All done!</h1>
          <p style={S.subtitle}>
            Your settings have been applied. Railway is redeploying the service now — this takes about a minute.
            Once complete, this wizard will be replaced by the running app.
          </p>
          <a href="https://railway.app/dashboard" target="_blank" rel="noreferrer"
            style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
            Watch the deployment →
          </a>
        </>
      );
    }

    return (
      <>
        <div style={S.stepLabel}>Almost there</div>
        <h1 style={S.h1}>Apply to Railway</h1>
        <p style={S.subtitle}>
          Enter your Railway API token and click Apply — the wizard will write all settings directly to this service.
          Railway will redeploy automatically.
        </p>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={S.label}>Railway API Token</label>
          <input style={S.input} type="password" placeholder="Paste your token here"
            value={railwayToken} onChange={e => { setRailwayToken(e.target.value); setApplyStatus('idle'); setApplyError(''); }} />
          <p style={S.hint}>
            Generate one at <a href="https://railway.app/account/tokens" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>railway.app/account/tokens</a> — any name will do
          </p>
          {applyStatus === 'error' && <div style={S.error}>{applyError}</div>}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={S.btnSecondary} onClick={() => setStep(3)}>← Back</button>
          <button
            style={{ ...S.btnPrimary, opacity: (!railwayToken.trim() || applyStatus === 'loading') ? 0.6 : 1 }}
            onClick={applyToRailway}
            disabled={!railwayToken.trim() || applyStatus === 'loading'}
          >
            {applyStatus === 'loading' ? 'Applying…' : 'Apply settings →'}
          </button>
        </div>

        <hr style={S.divider} />

        <button style={S.btnGhost} onClick={() => setShowCopyFallback(v => !v)}>
          {showCopyFallback ? '▾ Hide manual values' : '▸ Copy values manually instead'}
        </button>

        {showCopyFallback && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ ...S.hint, margin: '0 0 1rem' }}>
              Add these in your Railway service → Variables tab → Raw Editor.
            </p>
            <EnvRow label="YNAB_PERSONAL_ACCESS_TOKEN" value={ynabToken} />
            <EnvRow label="YNAB_BUDGET_ID" value={budgetId} />
            <EnvRow label="SENDERS" value={sendersJson} />
            {hasCurrency && <EnvRow label="CURRENCY_ACCOUNTS" value={currencyJson} />}
            <EnvRow label="ANTHROPIC_API_KEY" value={anthropicKey} />
            <EnvRow label="ADMIN_EMAIL" value={adminEmail} />
            {resendKey.trim() && <EnvRow label="RESEND_API_KEY" value={resendKey} />}
          </div>
        )}
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      <div style={S.card}>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
}
