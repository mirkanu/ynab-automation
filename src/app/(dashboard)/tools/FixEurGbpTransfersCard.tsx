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
}

interface FixResult {
  eurTxnId: string;
  gbpTxnId: string;
  eurAmountMilliunits: number;
  gbpAmountMilliunits: number;
  date: string;
  success: boolean;
  error?: string;
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
};

export default function FixEurGbpTransfersCard() {
  const [status, setStatus] = useState<Status>('idle');
  const [pairs, setPairs] = useState<TransferPair[]>([]);
  const [results, setResults] = useState<FixResult[]>([]);
  const [fixedCount, setFixed] = useState(0);
  const [errorMsg, setError] = useState('');

  async function handleAnalyse() {
    setStatus('analysing');
    setError('');
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
    try {
      const res = await fetch('/api/tools/fix-eur-transfers', { method: 'POST' });
      const data = await res.json() as { fixed?: number; failed?: number; results?: FixResult[]; error?: string };
      if (!res.ok && !data.results) {
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
            style={{ ...S.btnPrimary, backgroundColor: '#1d4ed8', opacity: status === 'running' ? 0.6 : 1 }}
            onClick={handleRun}
            disabled={status === 'running'}
          >
            {status === 'running' ? 'Running...' : 'Run Fix'}
          </button>
        )}

        {(status === 'success' || status === 'no-pairs') && (
          <button
            style={S.btnSecondary}
            onClick={() => { setStatus('idle'); setPairs([]); setResults([]); setFixed(0); setError(''); }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Pairs table (shown when status === 'pairs') */}
      {status === 'pairs' && pairs.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <p style={{ ...S.sectionDesc, marginTop: '1rem', marginBottom: '0.25rem' }}>
            <strong>Detected Transfer Pairs</strong>
          </p>
          <table style={S.table}>
            <thead>
              <tr>
                {['Date', 'EUR Out', 'From', 'GBP In', 'To', 'Confidence'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair, i) => (
                <tr key={pair.eurTxnId} style={{ backgroundColor: i % 2 === 1 ? '#f9fafb' : undefined }}>
                  <td style={S.td}>{pair.date}</td>
                  <td style={S.td}>EUR {toAmount(pair.eurAmountMilliunits)}</td>
                  <td style={S.td}>{accountName(pair.eurAccountId)}</td>
                  <td style={S.td}>GBP {toAmount(pair.gbpAmountMilliunits)}</td>
                  <td style={S.td}>{accountName(pair.gbpAccountId)}</td>
                  <td style={{ ...S.td, color: pair.confidence >= 80 ? '#166534' : '#b45309', fontWeight: 700 }}>
                    {pair.confidence}%
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
          <small>Please check your YNAB PAT and try again.</small>
        </div>
      )}
    </div>
  );
}
