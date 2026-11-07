'use client';
import { useState } from 'react';

interface TransferPair {
  eurTxnId: string;
  gbpTxnId: string;
  eurAmountMilliunits: number;
  gbpAmountMilliunits: number;
  eurAccountId: string;
  gbpAccountId: string;
  date: string;
  confidence: number;
  memo?: string;
}

interface FixResult {
  eurTxnId: string;
  gbpTxnId: string;
  eurAmountMilliunits: number;
  gbpAmountMilliunits: number;
  date: string;
  success: boolean;
  error?: string;
  memo?: string;
}

type Status = 'idle' | 'analysing' | 'pairs' | 'no-pairs' | 'running' | 'success' | 'error';

function toAmount(milliunits: number): string {
  return (Math.abs(milliunits) / 1000).toFixed(2);
}

const ACCOUNT_NAMES: Record<string, string> = {
  'f53855ba-ce7a-46bd-beae-cb8c1035a9e5': '€Wise Euro',
  '5bfba3fe-b8d4-41e1-8acb-c10459c99534': 'UK Current',
  '6f470dd5-67e4-4580-82ee-74154cd26f3c': 'GBP Wise',
};

function accountName(id: string): string {
  return ACCOUNT_NAMES[id] ?? id;
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
    fontSize: '1.25rem',
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
  btnPrimary: {
    display: 'inline-block' as const,
    padding: '0.5625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 700 as const,
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
    fontWeight: 700 as const,
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    marginLeft: '0.75rem',
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
  successBox: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '1rem',
    color: '#166534',
    marginTop: '1rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.8125rem',
    marginTop: '1rem',
    marginBottom: '1rem',
  },
  th: {
    textAlign: 'left' as const,
    fontWeight: 700 as const,
    fontSize: '0.8125rem',
    color: '#374151',
    padding: '0.5rem',
    borderBottom: '1px solid #d1d5db',
  },
  td: {
    padding: '0.5rem',
    color: '#111827',
    fontSize: '0.8125rem',
  },
  btnGhost: {
    display: 'inline-block' as const,
    padding: '0.3125rem 0.625rem',
    fontSize: '0.8125rem',
    fontWeight: 600 as const,
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  helperText: {
    fontSize: '0.8125rem',
    color: '#6b7280',
    margin: '0.5rem 0 0',
  },
  checkboxCell: {
    width: '1.75rem',
    padding: '0.5rem',
    textAlign: 'center' as const,
  },
};

export default function FixEurGbpTransfersCard() {
  const [status, setStatus] = useState<Status>('idle');
  const [pairs, setPairs] = useState<TransferPair[]>([]);
  const [results, setResults] = useState<FixResult[]>([]);
  const [fixedCount, setFixed] = useState(0);
  const [errorMsg, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // The selection UI only appears when there is a genuine choice to make.
  const showSelection = pairs.length > 1;
  const runDisabled = status === 'running' || (showSelection && selectedIds.size === 0);

  function togglePair(eurTxnId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(eurTxnId)) next.delete(eurTxnId); else next.add(eurTxnId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(pairs.map(p => p.eurTxnId)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleAnalyse() {
    setStatus('analysing');
    setError('');
    setErrorStatus(null);
    try {
      const res = await fetch('/api/tools/fix-eur-transfers?dry=true');
      const data = await res.json() as { pairs?: TransferPair[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`);
        setStatus('error');
        return;
      }
      if (!data.pairs || data.pairs.length === 0) {
        setStatus('no-pairs');
        return;
      }
      setSelectedIds(new Set());
      setPairs(data.pairs);
      setStatus('pairs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  async function handleRun() {
    setStatus('running');
    setError('');
    setErrorStatus(null);
    try {
      // Only ids are sent — never amounts or dates. The server re-detects the
      // pairs and uses its own values, so the selection cannot be forged.
      const ids = pairs.length === 1 ? [pairs[0].eurTxnId] : Array.from(selectedIds);
      const res = await fetch('/api/tools/fix-eur-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eurTxnIds: ids }),
      });
      const data = await res.json() as { fixed?: number; failed?: number; results?: FixResult[]; error?: string };
      if (!res.ok && !data.results) {
        setErrorStatus(res.status);
        setError(data.error ?? `HTTP ${res.status}`);
        setStatus('error');
        return;
      }
      setFixed(data.fixed ?? 0);
      setResults(data.results ?? []);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>Fix EUR→GBP Transfers</h2>
      <p style={S.sectionDesc}>
        Detected transfer pairs from the last 7 days are analysed below.
        Click Analyse to find matches, then Run Fix to apply corrections.
      </p>

      {/* Buttons row */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          style={{ ...S.btnPrimary, opacity: status === 'analysing' || status === 'running' ? 0.6 : 1, cursor: status === 'analysing' || status === 'running' ? 'not-allowed' : 'pointer' }}
          onClick={handleAnalyse}
          disabled={status === 'analysing' || status === 'running'}
        >
          {status === 'analysing' ? 'Analysing...' : 'Analyse'}
        </button>

        {(status === 'pairs' || status === 'running') && (
          <button
            style={{ ...S.btnPrimary, backgroundColor: '#1d4ed8', opacity: runDisabled ? 0.6 : 1, cursor: runDisabled ? 'not-allowed' : 'pointer' }}
            onClick={handleRun}
            disabled={runDisabled}
          >
            {status === 'running' ? 'Running...' : showSelection ? `Run Fix (${selectedIds.size})` : 'Run Fix'}
          </button>
        )}

        {(status === 'success' || status === 'no-pairs') && (
          <button
            style={S.btnSecondary}
            onClick={() => { setStatus('idle'); setPairs([]); setResults([]); setFixed(0); setError(''); setSelectedIds(new Set()); }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Helper line — tells the user why Run Fix is disabled */}
      {showSelection && (status === 'pairs' || status === 'running') && selectedIds.size === 0 && (
        <p style={S.helperText}>Select at least one transfer to enable Run Fix.</p>
      )}

      {/* Pairs table (shown when status === 'pairs') */}
      {status === 'pairs' && pairs.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <p style={{ ...S.sectionDesc, marginTop: '1rem', marginBottom: '0.25rem' }}>
            <strong>Detected Transfer Pairs</strong>
          </p>
          {showSelection && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <button type="button" style={S.btnGhost} onClick={selectAll}>Select all</button>
              <button type="button" style={S.btnGhost} onClick={clearSelection}>Clear</button>
              <span style={{ ...S.helperText, margin: 0 }}>
                {selectedIds.size} of {pairs.length} selected
              </span>
            </div>
          )}
          <table style={S.table}>
            <thead>
              <tr>
                {showSelection && <th style={S.th}>Select</th>}
                {['Date', 'EUR Out', 'From', 'GBP In', 'To', 'Confidence', 'Memo to be written'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair, i) => (
                <tr
                  key={pair.eurTxnId}
                  style={{
                    backgroundColor: showSelection && selectedIds.has(pair.eurTxnId)
                      ? '#eff6ff'
                      : i % 2 === 1 ? '#f9fafb' : undefined,
                  }}
                >
                  {showSelection && (
                    <td style={S.checkboxCell}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(pair.eurTxnId)}
                        onChange={() => togglePair(pair.eurTxnId)}
                        aria-label={`Select transfer on ${pair.date}`}
                      />
                    </td>
                  )}
                  <td style={S.td}>{pair.date}</td>
                  <td style={S.td}>EUR {toAmount(pair.eurAmountMilliunits)}</td>
                  <td style={S.td}>{accountName(pair.eurAccountId)}</td>
                  <td style={S.td}>GBP {toAmount(pair.gbpAmountMilliunits)}</td>
                  <td style={S.td}>{accountName(pair.gbpAccountId)}</td>
                  <td style={{ ...S.td, color: pair.confidence >= 80 ? '#166534' : '#b45309', fontWeight: 700 }}>
                    {pair.confidence}%
                  </td>
                  <td style={{ ...S.td, fontStyle: 'italic', color: '#6b7280', maxWidth: '22rem' }}>
                    {pair.memo ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No pairs state */}
      {status === 'no-pairs' && (
        <p style={{ ...S.sectionDesc, marginTop: '0.75rem' }}>
          No unreconciled EUR→GBP transfers found. All recent transfers are already reconciled or don&apos;t match the pattern.
        </p>
      )}

      {/* Success result panel */}
      {status === 'success' && (
        <div style={S.successBox}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>
            {fixedCount} {fixedCount === 1 ? 'transfer' : 'transfers'} fixed
          </p>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem' }}>
            {results.filter(r => r.success).map(r => (
              <li key={r.eurTxnId} style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
                EUR {toAmount(r.eurAmountMilliunits)} → GBP {toAmount(r.gbpAmountMilliunits)} ({r.date})
                {r.memo && (
                  <div style={{ color: '#6b7280', fontStyle: 'italic' }}>Memo: {r.memo}</div>
                )}
              </li>
            ))}
            {results.filter(r => !r.success).map(r => (
              <li key={r.eurTxnId} style={{ fontSize: '0.8125rem', lineHeight: 1.5, color: '#dc2626' }}>
                EUR {toAmount(r.eurAmountMilliunits)} failed: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error box */}
      {status === 'error' && errorMsg && (
        <div style={S.error}>
          {errorMsg}
          <br />
          {errorStatus === 400
            ? <small>Pick the transfers to fix and try again.</small>
            : <small>Please check your YNAB PAT and try again.</small>}
        </div>
      )}
    </div>
  );
}
