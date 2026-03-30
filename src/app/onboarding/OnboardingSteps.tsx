'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  ynabConnected: boolean
  forwardingEmail: string | null
  providerTitle: string | null
  providerSteps: string[] | null
  providerHelpUrl: string | null
}

const stepCard = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  border: '1px solid #e5e7eb',
}

const completedCard = {
  ...stepCard,
  borderColor: '#bbf7d0',
  backgroundColor: '#f0fdf4',
}

export default function OnboardingSteps({
  ynabConnected,
  forwardingEmail,
  providerTitle,
  providerSteps,
  providerHelpUrl,
}: Props) {
  const router = useRouter()
  const [completing, setCompleting] = useState(false)
  const [copied, setCopied] = useState(false)

  const allDone = ynabConnected && !!forwardingEmail

  async function handleComplete() {
    setCompleting(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
      router.push('/')
    } catch {
      setCompleting(false)
    }
  }

  async function handleCopy() {
    if (forwardingEmail) {
      await navigator.clipboard.writeText(forwardingEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Step 1: Connect YNAB */}
      <div style={ynabConnected ? completedCard : stepCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: ynabConnected ? '#16a34a' : '#2563eb',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {ynabConnected ? '✓' : '1'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
              Connect YNAB
            </div>
            {ynabConnected ? (
              <div style={{ fontSize: '0.875rem', color: '#16a34a' }}>
                YNAB account connected successfully
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Link your YNAB account so transactions can be automatically created.
                </div>
                <a
                  href="/api/ynab/authorize"
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Connect YNAB
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: Forwarding address */}
      <div style={forwardingEmail ? completedCard : stepCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: forwardingEmail ? '#16a34a' : '#9ca3af',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {forwardingEmail ? '✓' : '2'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
              Your forwarding address
            </div>
            {forwardingEmail ? (
              <>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  Forward your order confirmation emails to:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <code style={{
                    flex: 1,
                    fontSize: '0.8125rem',
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    color: '#111827',
                    backgroundColor: '#f9fafb',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {forwardingEmail}
                  </code>
                  <button
                    onClick={handleCopy}
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      backgroundColor: copied ? '#f0fdf4' : '#fff',
                      color: copied ? '#16a34a' : '#374151',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                Your unique forwarding address will appear here after connecting YNAB.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Email forwarding instructions */}
      <div style={stepCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: '#9ca3af',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            3
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
              {providerTitle ?? 'Set up email forwarding'}
            </div>
            {providerSteps ? (
              <>
                <ol style={{ margin: '0.5rem 0 0.75rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {providerSteps.map((step, i) => (
                    <li key={i} style={{ fontSize: '0.875rem', color: '#374151' }}>
                      {step}
                    </li>
                  ))}
                </ol>
                {providerHelpUrl && (
                  <a
                    href={providerHelpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: '#2563eb' }}
                  >
                    View detailed instructions
                  </a>
                )}
              </>
            ) : (
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                Instructions will appear here once your forwarding address is ready.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Go to dashboard button */}
      <div style={{ marginTop: '0.5rem' }}>
        <button
          onClick={handleComplete}
          disabled={completing}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: allDone ? '#2563eb' : '#e5e7eb',
            color: allDone ? '#fff' : '#9ca3af',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: completing ? 'not-allowed' : 'pointer',
            opacity: completing ? 0.7 : 1,
          }}
        >
          {completing ? 'Redirecting...' : 'Go to dashboard'}
        </button>
        {!allDone && (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' as const, marginTop: '0.5rem' }}>
            Complete the steps above or skip to get started
          </p>
        )}
      </div>
    </div>
  )
}
