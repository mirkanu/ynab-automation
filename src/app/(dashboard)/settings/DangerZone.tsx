'use client';
import { useState } from 'react';

export default function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Failed to delete account');
        setDeleting(false);
        setConfirming(false);
        return;
      }
      // Success — redirect to sign in (session is now invalid)
      window.location.href = '/auth/signin';
    } catch {
      setError('Network error — please try again');
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '1.5rem',
      border: '1px solid #fecaca',
    }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#991b1b', margin: '0 0 0.25rem' }}>
        Danger Zone
      </h2>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          style={{
            padding: '0.5rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: '#dc2626',
            border: '1px solid #dc2626',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Delete Account
        </button>
      ) : (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
        }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#991b1b', margin: '0 0 0.75rem' }}>
            Are you sure? This will permanently delete:
          </p>
          <ul style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 1rem', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
            <li>Your account and profile</li>
            <li>All activity logs and processed emails</li>
            <li>Your YNAB connection and token</li>
            <li>Your forwarding email address</li>
            <li>All settings</li>
          </ul>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.7 : 1,
              }}
            >
              {deleting ? 'Deleting...' : 'Yes, delete my account'}
            </button>
            <button
              onClick={() => { setConfirming(false); setError(''); }}
              disabled={deleting}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                backgroundColor: 'transparent',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          {error && (
            <div style={{ fontSize: '0.8125rem', color: '#dc2626', marginTop: '0.75rem' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
