'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TestModeBanner({ testMode }: { testMode: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleTestMode() {
    setLoading(true);
    try {
      await fetch('/api/settings/test-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !testMode }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!testMode) return null;

  return (
    <div style={{
      backgroundColor: '#dcfce7',
      borderBottom: '1px solid #86efac',
      padding: '0.5rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '0.8125rem',
    }}>
      <div>
        <span style={{ fontWeight: 600, color: '#166534' }}>Test Mode</span>
        <span style={{ color: '#166534', marginLeft: '0.375rem' }}>
          — Emails are parsed but not written to YNAB
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={toggleTestMode}
          disabled={loading}
          style={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: '#166534',
            background: 'transparent',
            border: '1px solid #86efac',
            borderRadius: '0.375rem',
            padding: '0.25rem 0.625rem',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Turning off...' : 'Turn off'}
        </button>
        <a href="/settings" style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 500 }}>
          Settings
        </a>
      </div>
    </div>
  );
}
