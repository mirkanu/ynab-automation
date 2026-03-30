'use client';
import { useState } from 'react';

interface SettingsFormProps {
  testMode: boolean;
  forwardingEmail: string | null;
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
  hint: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
    lineHeight: 1.4,
  },
  fieldRow: {
    marginBottom: '0.625rem',
  },
};

export default function SettingsForm({ testMode: initialTestMode, forwardingEmail }: SettingsFormProps) {
  const [testMode, setTestMode] = useState(initialTestMode);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle');

  async function handleTestModeToggle() {
    const newValue = !testMode;
    // Optimistic update
    setTestMode(newValue);
    setSaving(true);
    setSaveResult('idle');

    try {
      const res = await fetch('/api/settings/test-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setTestMode(!newValue);
        setSaveResult('error');
      } else {
        setSaveResult('success');
      }
    } catch {
      // Revert on failure
      setTestMode(!newValue);
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Test Mode */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Email Processing</h2>
        <p style={S.sectionDesc}>
          Control how forwarded emails are handled.
        </p>

        <div style={{
          ...S.fieldRow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: testMode ? '#dbeafe' : '#f9fafb',
          border: `1px solid ${testMode ? '#93c5fd' : '#e5e7eb'}`,
          borderRadius: '8px',
          marginBottom: '0.5rem',
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: testMode ? '#1e40af' : '#374151' }}>
              Test Mode
            </div>
            <div style={{ fontSize: '0.75rem', color: testMode ? '#1e40af' : '#6b7280', marginTop: '0.125rem' }}>
              {testMode
                ? 'Emails are parsed but NOT written to YNAB'
                : 'Emails are processed and written to YNAB normally'}
            </div>
          </div>
          <button
            onClick={handleTestModeToggle}
            disabled={saving}
            style={{
              position: 'relative' as const,
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: testMode ? '#2563eb' : '#d1d5db',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              flexShrink: 0,
              opacity: saving ? 0.7 : 1,
            }}
            aria-label={testMode ? 'Disable test mode' : 'Enable test mode'}
          >
            <span style={{
              position: 'absolute' as const,
              top: '2px',
              left: testMode ? '22px' : '2px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        {saveResult === 'error' && (
          <div style={{ fontSize: '0.8125rem', color: '#dc2626', marginTop: '0.5rem' }}>
            Failed to update test mode. Please try again.
          </div>
        )}
        {saveResult === 'success' && (
          <div style={{ fontSize: '0.8125rem', color: '#16a34a', marginTop: '0.5rem' }}>
            Test mode updated.
          </div>
        )}
      </div>

      {/* Forwarding Email */}
      {forwardingEmail && (
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Forwarding Address</h2>
          <p style={S.sectionDesc}>
            Your unique email address for forwarding order confirmation emails. This address is assigned at signup and cannot be changed.
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 0.875rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: '0.875rem',
            color: '#111827',
          }}>
            {forwardingEmail}
          </div>
          <p style={S.hint}>
            Forward order confirmation emails to this address for automatic processing.
          </p>
        </div>
      )}
    </div>
  );
}
