'use client';
import { useState } from 'react';

interface ReconciliationStatus {
  wiseEurBalance:         number;
  eurGbpRate:             number;
  wiseGbpEquivalent:      number;
  ynabClearedBalance:     number;
  gap:                    number;
  lastReconciliationDate: string | null;
  daysSinceLastRecon:     number | null;
  clearedCount:           number;
}

interface ReconciliationResult {
  adjustmentGbp:          number;
  interestGbp:            number;
  interestSharePct:       number;
  transactionsReconciled: number;
  memo:                   string;
}

type Status = 'idle' | 'loading' | 'review' | 'problem' | 'running' | 'done' | 'error';

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const S = {
  section: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1.5rem',
  },
  title: { fontSize: '1.25rem', fontWeight: 700 as const, color: '#111827', margin: '0 0 0.25rem' },
  desc:  { fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 1.25rem', lineHeight: 1.5 },
  btnPrimary: {
    padding: '0.5625rem 1.25rem', fontSize: '0.875rem', fontWeight: 700 as const,
    backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
  },
  btnSecondary: {
    padding: '0.5625rem 1.25rem', fontSize: '0.875rem', fontWeight: 700 as const,
    backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db',
    borderRadius: '6px', cursor: 'pointer',
  },
  btnSuccess: {
    padding: '0.5625rem 1.25rem', fontSize: '0.875rem', fontWeight: 700 as const,
    backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
  },
  row:  { display: 'flex' as const, justifyContent: 'space-between' as const, padding: '0.375rem 0', fontSize: '0.875rem', borderBottom: '1px solid #f3f4f6' },
  label: { color: '#6b7280' },
  value: { fontWeight: 600 as const, color: '#111827' },
  errorBox: {
    fontSize: '0.8125rem', color: '#dc2626', backgroundColor: '#fef2f2',
    border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem 1rem', marginTop: '1rem',
  },
  warningBox: {
    fontSize: '0.8125rem', color: '#92400e', backgroundColor: '#fffbeb',
    border: '1px solid #fde68a', borderRadius: '6px', padding: '0.75rem 1rem', marginTop: '1rem',
  },
  successBox: {
    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '8px', padding: '1rem', color: '#166534', marginTop: '1rem',
  },
  infoBox: {
    fontSize: '0.8125rem', color: '#1e40af', backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.875rem 1rem', marginTop: '1rem',
  },
  inputRow: { display: 'flex' as const, alignItems: 'center' as const, gap: '0.5rem', margin: '1rem 0' },
  input: {
    width: '80px', padding: '0.4rem 0.6rem', fontSize: '0.875rem',
    border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' as const,
  },
};

export default function ReconcileEurWiseCard() {
  const [status, setStatus]           = useState<Status>('idle');
  const [data, setData]               = useState<ReconciliationStatus | null>(null);
  const [result, setResult]           = useState<ReconciliationResult | null>(null);
  const [interestRate, setInterestRate] = useState('1.80');
  const [errorMsg, setError]          = useState('');

  const rate        = parseFloat(interestRate) || 0;
  const days        = data?.daysSinceLastRecon ?? 30;
  const estInterest = data
    ? Math.round(data.wiseEurBalance * (rate / 100) * (days / 365) * data.eurGbpRate * 100) / 100
    : 0;
  const sharePct = data && data.gap !== 0
    ? Math.round((estInterest / Math.abs(data.gap)) * 100)
    : 0;
  // Implied rate: the EUR-GBP rate at which wiseEurBalance would exactly equal
  // ynabClearedBalance. This is NOT a historical actual rate; there is no stored rate history.
  // It is a derived "what rate would reconcile cleanly" figure.
  const impliedRate = data && data.wiseEurBalance !== 0
    ? data.ynabClearedBalance / data.wiseEurBalance
    : 0;
  const rateDeltaPct = data && impliedRate !== 0
    ? ((data.eurGbpRate - impliedRate) / impliedRate) * 100
    : 0;

  async function handleFetch() {
    setStatus('loading');
    setError('');
    setData(null);
    try {
      const res  = await fetch('/api/tools/reconcile-eur-wise');
      const json = await res.json() as ReconciliationStatus & { error?: string };
      if (!res.ok || json.error) { setError(json.error ?? `HTTP ${res.status}`); setStatus('error'); return; }
      setData(json);
      setStatus(json.gap < 0 ? 'problem' : 'review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  async function handleApply() {
    setStatus('running');
    setError('');
    try {
      const res  = await fetch('/api/tools/reconcile-eur-wise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestRate: rate }),
      });
      const json = await res.json() as ReconciliationResult & { error?: string };
      if (!res.ok || json.error) { setError(json.error ?? `HTTP ${res.status}`); setStatus('error'); return; }
      setResult(json);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  function reset() {
    setStatus('idle'); setData(null); setResult(null); setError('');
  }

  return (
    <div style={S.section}>
      <h2 style={S.title}>Reconcile €Wise Euro</h2>
      <p style={S.desc}>
        Compares the live Wise EUR balance (converted to GBP) against the YNAB cleared balance,
        then applies a Wise Interest reconciliation entry and marks all cleared transactions as reconciled.
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {(status === 'idle' || status === 'error') && (
          <button style={S.btnPrimary} onClick={handleFetch}>Check Balances</button>
        )}
        {(status === 'done' || status === 'problem') && (
          <button style={S.btnSecondary} onClick={reset}>Reset</button>
        )}
        {status === 'loading' && (
          <button style={{ ...S.btnPrimary, opacity: 0.6, cursor: 'not-allowed' }} disabled>Loading…</button>
        )}
        {status === 'running' && (
          <button style={{ ...S.btnPrimary, opacity: 0.6, cursor: 'not-allowed' }} disabled>Applying…</button>
        )}
      </div>

      {/* Balance summary */}
      {data && status !== 'done' && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={S.row}><span style={S.label}>Wise EUR balance</span>         <span style={S.value}>€{fmt(data.wiseEurBalance)}</span></div>
          <div style={S.row}><span style={S.label}>EUR→GBP rate (Wise)</span>      <span style={S.value}>{data.eurGbpRate.toFixed(4)}</span></div>
          <div style={S.row}><span style={S.label}>Wise equivalent in GBP</span>   <span style={S.value}>£{fmt(data.wiseGbpEquivalent)}</span></div>
          <div style={S.row}><span style={S.label}>YNAB cleared balance</span>     <span style={S.value}>£{fmt(data.ynabClearedBalance)}</span></div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={S.label}>Gap</span>
            <span style={{ ...S.value, color: data.gap < 0 ? '#dc2626' : data.gap > 0 ? '#16a34a' : '#6b7280' }}>
              {data.gap >= 0 ? '+' : ''}£{fmt(data.gap)}
            </span>
          </div>
          {data.lastReconciliationDate && (
            <p style={{ ...S.desc, marginTop: '0.75rem', marginBottom: 0 }}>
              Last reconciled: <strong>{data.lastReconciliationDate}</strong> ({data.daysSinceLastRecon} days ago)
              · {data.clearedCount} cleared transactions pending
            </p>
          )}
        </div>
      )}

      {/* Problem state */}
      {status === 'problem' && data && (
        <div style={S.warningBox}>
          <strong>⚠ Wise balance is lower than YNAB</strong><br />
          Wise GBP equivalent (£{fmt(data.wiseGbpEquivalent)}) is less than YNAB cleared balance
          (£{fmt(data.ynabClearedBalance)}). This suggests a missing transaction or an error.
          Manual review required before reconciling.
        </div>
      )}

      {/* Review + interest rate input */}
      {status === 'review' && data && (
        <>
          <div style={S.inputRow}>
            <label style={{ fontSize: '0.875rem', color: '#374151' }}>
              Current Wise EUR interest rate:
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={interestRate}
              onChange={e => setInterestRate(e.target.value)}
              style={S.input}
            />
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>% per year</span>
          </div>

          <div style={{
            backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '1rem',
            fontSize: '0.875rem', color: '#166534',
          }}>
            <strong>{rate}% over {days} days</strong> accounts for{' '}
            <strong>£{fmt(estInterest)}</strong> of the{' '}
            <strong>£{fmt(data.gap)}</strong> gap{' '}
            ({sharePct}%)
            {sharePct >= 80 && sharePct <= 120 && ' — consistent with interest only ✓'}
            {sharePct < 50 && ' — interest explains less than half; check for missing transactions'}
            {sharePct > 120 && ' — interest overshoot; rate may be too high'}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              style={{ ...S.btnSuccess, opacity: rate <= 0 ? 0.6 : 1 }}
              onClick={handleApply}
              disabled={rate <= 0}
            >
              Accept &amp; Reconcile
            </button>
            <button style={S.btnSecondary} onClick={reset}>Cancel</button>
          </div>
        </>
      )}

      {/* Success */}
      {status === 'done' && result && (
        <div style={S.successBox}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Reconciliation complete</p>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.8125rem' }}>
            Adjustment: <strong>+£{fmt(result.adjustmentGbp)}</strong>
            {' '}({result.interestSharePct}% attributed to {interestRate}% interest)
          </p>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.8125rem' }}>
            Transactions reconciled: <strong>{result.transactionsReconciled}</strong>
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#4b7c59', fontFamily: 'monospace' }}>
            {result.memo}
          </p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div style={S.errorBox}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
