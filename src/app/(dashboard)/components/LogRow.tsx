'use client';
import { useState } from 'react';

interface LogEntry {
  id: number;
  messageId: string;
  status: string;
  sender: string | null;
  subject: string | null;
  receivedAt: string; // ISO string from server
  rawBody: string | null;
  parseResult: Record<string, unknown> | null;
  ynabResult: Record<string, unknown> | null;
  errorType: string | null;
  errorMessage: string | null;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  success: { bg: '#dcfce7', text: '#166534' },
  test: { bg: '#dbeafe', text: '#1e40af' },
  parse_error: { bg: '#fef2f2', text: '#991b1b' },
  ynab_error: { bg: '#fef2f2', text: '#991b1b' },
  unknown_sender: { bg: '#fefce8', text: '#854d0e' },
  duplicate: { bg: '#f3f4f6', text: '#6b7280' },
  no_message_id: { bg: '#f3f4f6', text: '#6b7280' },
};

const statusLabels: Record<string, string> = {
  success: 'Success',
  test: 'Test Only',
  parse_error: 'Parse Error',
  ynab_error: 'YNAB Error',
  unknown_sender: 'Unknown Sender',
  duplicate: 'Duplicate',
  no_message_id: 'No ID',
};

type ReplayStatus = 'idle' | 'confirm' | 'confirm-live' | 'loading' | 'success' | 'error';

export default function LogRow({ entry, testMode }: { entry: LogEntry; testMode?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [replayStatus, setReplayStatus] = useState<ReplayStatus>('idle');
  const [replayResult, setReplayResult] = useState('');

  async function handleReplay(forceLive = false) {
    setReplayStatus('loading');
    setReplayResult('');
    try {
      const res = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: entry.messageId, forceLive }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        transactionId?: string;
        testMode?: boolean;
        error?: string;
      };
      if (!res.ok || data.error) {
        setReplayResult(data.error ?? 'Unknown error');
        setReplayStatus('error');
      } else if (data.testMode) {
        setReplayResult('Replayed in test mode — parsed successfully, no YNAB transaction');
        setReplayStatus('success');
      } else {
        setReplayResult(`Transaction created: ${data.transactionId}`);
        setReplayStatus('success');
      }
    } catch (e) {
      setReplayResult((e as Error).message);
      setReplayStatus('error');
    }
  }

  const isTestEntry = entry.status === 'test';
  const colors = statusColors[entry.status] ?? { bg: '#f3f4f6', text: '#374151' };
  const date = new Date(entry.receivedAt);

  return (
    <div style={{ borderBottom: '1px solid #e5e7eb' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 100px',
          gap: '0.75rem',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          backgroundColor: expanded ? '#f9fafb' : 'transparent',
        }}
      >
        <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
          {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
          {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.sender ?? 'unknown'}{entry.subject ? ` — ${entry.subject}` : ''}
        </span>
        <span style={{
          display: 'inline-block',
          fontSize: '0.6875rem',
          fontWeight: 600,
          padding: '0.125rem 0.5rem',
          borderRadius: '9999px',
          backgroundColor: colors.bg,
          color: colors.text,
          textAlign: 'center',
        }}>
          {statusLabels[entry.status] ?? entry.status}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 1rem 1rem 1rem', fontSize: '0.8125rem', color: '#374151' }}>
          <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '640px' }}>
            {entry.subject && (
              <Section label="Subject">{entry.subject}</Section>
            )}

            {entry.parseResult && (
              <Section label="Parse Result">
                <KV label="Retailer" value={String(entry.parseResult.retailer ?? '')} />
                <KV label="Amount" value={String(entry.parseResult.amount ?? '')} />
                <KV label="Date" value={String(entry.parseResult.date ?? '')} />
                <KV label="Currency" value={String(entry.parseResult.currency ?? '')} />
                {entry.parseResult.description ? <KV label="Description" value={String(entry.parseResult.description)} /> : null}
              </Section>
            )}

            {entry.ynabResult && (
              <Section label="YNAB Result">
                <KV label="Transaction ID" value={String(entry.ynabResult.transactionId ?? '')} />
                <KV label="Amount" value={`${entry.ynabResult.amount} milliunits`} />
                <KV label="Account" value={String(entry.ynabResult.accountId ?? '')} />
                <KV label="Payee" value={String(entry.ynabResult.payeeName ?? '')} />
              </Section>
            )}

            {(entry.errorType || entry.errorMessage) && (
              <Section label="Error">
                {entry.errorType && <KV label="Type" value={entry.errorType} />}
                {entry.errorMessage && <KV label="Message" value={entry.errorMessage} />}
              </Section>
            )}

            {entry.rawBody && (
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRaw(!showRaw); }}
                  style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showRaw ? 'Hide' : 'Show'} raw email
                </button>
                {showRaw && (
                  <pre style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.6875rem',
                    overflow: 'auto',
                    maxHeight: '300px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {entry.rawBody}
                  </pre>
                )}
              </div>
            )}

            {/* Replay / Run live buttons — only when rawBody exists */}
            {entry.rawBody && (
              <div style={{ marginTop: '0.5rem' }}>
                {replayStatus === 'idle' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Replay: in test mode runs without YNAB, otherwise needs confirm */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (testMode) handleReplay(false);
                        else setReplayStatus('confirm');
                      }}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.375rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#fff',
                        color: '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      Replay{testMode ? ' (test)' : ''}
                    </button>
                    {/* Run live: for test entries, replay but force YNAB write */}
                    {isTestEntry && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplayStatus('confirm-live'); }}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.375rem 0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: '#fff',
                          color: '#2563eb',
                          cursor: 'pointer',
                        }}
                      >
                        Run live
                      </button>
                    )}
                  </div>
                )}
                {replayStatus === 'confirm' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ color: '#dc2626', fontWeight: 500 }}>
                      This will create a real YNAB transaction. Continue?
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReplay(false); }}
                      style={{
                        fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem',
                        border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', cursor: 'pointer',
                      }}
                    >
                      Yes, replay
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplayStatus('idle'); }}
                      style={{
                        fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                        border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', color: '#374151', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {replayStatus === 'confirm-live' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ color: '#dc2626', fontWeight: 500 }}>
                      This will create a real YNAB transaction. Continue?
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReplay(true); }}
                      style={{
                        fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem',
                        border: 'none', borderRadius: '6px', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer',
                      }}
                    >
                      Yes, run live
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplayStatus('idle'); }}
                      style={{
                        fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                        border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', color: '#374151', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {replayStatus === 'loading' && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Replaying...</span>
                )}
                {replayStatus === 'success' && (
                  <div style={{
                    fontSize: '0.75rem', color: '#16a34a', backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 0.75rem',
                  }}>
                    {replayResult}
                  </div>
                )}
                {replayStatus === 'error' && (
                  <div style={{
                    fontSize: '0.75rem', color: '#dc2626', backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca', borderRadius: '6px', padding: '0.5rem 0.75rem',
                  }}>
                    Replay failed: {replayResult}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
              Message ID: {entry.messageId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.6 }}>
      <span style={{ color: '#6b7280', minWidth: '100px' }}>{label}:</span>
      <span style={{ color: '#111827' }}>{value}</span>
    </div>
  );
}
