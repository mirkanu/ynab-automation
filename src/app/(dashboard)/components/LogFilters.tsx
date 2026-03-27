'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const statuses = [
  { value: '', label: 'All statuses' },
  { value: 'success', label: 'Success' },
  { value: 'parse_error', label: 'Parse Error' },
  { value: 'ynab_error', label: 'YNAB Error' },
  { value: 'unknown_sender', label: 'Unknown Sender' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'no_message_id', label: 'No Message ID' },
];

const inputStyle = {
  padding: '0.5rem 0.75rem', fontSize: '0.875rem',
  border: '1px solid #d1d5db', borderRadius: '6px',
  outline: 'none', color: '#111827', backgroundColor: '#fff',
  boxSizing: 'border-box' as const,
};

export default function LogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');

  function applyFilters() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.push('/logs' + (params.toString() ? '?' + params.toString() : ''));
  }

  function clearFilters() {
    setStatus('');
    setFrom('');
    setTo('');
    router.push('/logs');
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, minWidth: '160px' }}>
          {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
      </div>
      <button onClick={applyFilters} style={{
        padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
        backgroundColor: '#2563eb', color: '#fff',
        border: 'none', borderRadius: '6px', cursor: 'pointer',
      }}>
        Filter
      </button>
      {(status || from || to) && (
        <button onClick={clearFilters} style={{
          fontSize: '0.8125rem', color: '#6b7280', background: 'none',
          border: 'none', cursor: 'pointer', padding: '0.5rem 0',
        }}>
          Clear
        </button>
      )}
    </div>
  );
}
