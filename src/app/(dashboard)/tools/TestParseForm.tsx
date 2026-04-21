'use client';
import { useState } from 'react';

interface TestParseFormProps {
  defaultSenderName: string;
}

interface ParsedResult {
  amount: number;
  description: string;
  retailer: string;
  currency: string;
  date: string;
  customNote?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

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
  textarea: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '0.75rem',
    fontSize: '0.8125rem',
    fontFamily: 'monospace',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    color: '#111827',
    backgroundColor: '#fff',
    resize: 'vertical' as const,
    minHeight: '200px',
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
  fieldRow: {
    marginBottom: '0.625rem',
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
  resultCard: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '1rem',
  },
  resultRow: {
    display: 'flex' as const,
    gap: '0.5rem',
    fontSize: '0.8125rem',
    lineHeight: 1.6,
  },
  resultLabel: {
    color: '#6b7280',
    minWidth: '100px',
  },
  resultValue: {
    color: '#111827',
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
};

export default function TestParseForm({ defaultSenderName }: TestParseFormProps) {
  const [html, setHtml] = useState('');
  const [senderName, setSenderName] = useState(defaultSenderName);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleParse() {
    if (!html.trim()) return;
    setStatus('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/test-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, senderName: senderName || 'Test' }),
      });
      const data = (await res.json()) as {
        result?: ParsedResult;
        error?: string;
      };

      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? 'Unknown error');
        setStatus('error');
        return;
      }

      setResult(data.result ?? null);
      setStatus('success');
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStatus('error');
    }
  }

  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>Email Parse Preview</h2>
      <p style={S.sectionDesc}>
        Paste an order confirmation email's HTML below to test Claude's parsing.
        No YNAB transaction will be created.
      </p>

      <div style={S.fieldRow}>
        <label style={S.label}>Sender Name</label>
        <input
          style={{ ...S.input, maxWidth: '300px' }}
          type="text"
          placeholder="e.g. Alice"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
        />
        <p style={S.hint}>
          Used in the YNAB memo preview. Does not affect parsing.
        </p>
      </div>

      <div style={S.fieldRow}>
        <label style={S.label}>Email HTML</label>
        <textarea
          style={S.textarea}
          placeholder="Paste the full HTML of an order confirmation email here..."
          value={html}
          onChange={(e) => setHtml(e.target.value)}
        />
      </div>

      <button
        style={{
          ...S.btnPrimary,
          opacity: status === 'loading' || !html.trim() ? 0.6 : 1,
        }}
        onClick={handleParse}
        disabled={status === 'loading' || !html.trim()}
      >
        {status === 'loading' ? 'Parsing...' : 'Parse Email'}
      </button>

      {status === 'error' && <div style={S.error}>{errorMsg}</div>}

      {status === 'success' && result && (
        <div style={S.resultCard}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
            {result.retailer}
          </div>
          <div style={S.resultRow}>
            <span style={S.resultLabel}>Amount:</span>
            <span style={S.resultValue}>
              {result.amount} {result.currency}
            </span>
          </div>
          <div style={S.resultRow}>
            <span style={S.resultLabel}>Description:</span>
            <span style={S.resultValue}>{result.description}</span>
          </div>
          <div style={S.resultRow}>
            <span style={S.resultLabel}>Date:</span>
            <span style={S.resultValue}>{result.date}</span>
          </div>
          <div style={S.memoPreview}>
            YNAB memo: {senderName || 'Test'}: {result.description} - {result.customNote?.trim() || 'Automatically added from email'}
          </div>
        </div>
      )}
    </div>
  );
}
