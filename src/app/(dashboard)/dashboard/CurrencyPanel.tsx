'use client'

import { useState, useEffect } from 'react'
import type { LastToolRuns, ToolRunEntry } from '@/lib/tool-run-queries'

const card = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}

const labelStyle = {
  fontSize: '0.8125rem',
  fontWeight: 400,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const valueStyle = {
  fontSize: '0.8125rem',
  color: '#374151',
  marginTop: '0.25rem',
}

const subValueStyle = {
  fontSize: '0.8125rem',
  color: '#9ca3af',
  marginTop: '0.125rem',
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ToolRow({
  label,
  entry,
  fallback,
  subText,
}: {
  label: string
  entry: ToolRunEntry | null
  fallback: string
  subText: (entry: ToolRunEntry) => string | null
}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {entry ? (
        <>
          <div style={valueStyle}>{formatDate(entry.runAt)}</div>
          {(() => {
            const sub = subText(entry)
            return sub ? <div style={subValueStyle}>{sub}</div> : null
          })()}
        </>
      ) : (
        <div style={valueStyle}>{fallback}</div>
      )}
    </div>
  )
}

export default function CurrencyPanel() {
  const [data, setData] = useState<LastToolRuns | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    function fetchStatus() {
      fetch('/api/dashboard/currency-status')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then((d: LastToolRuns) => { setData(d); setError(false) })
        .catch(() => setError(true))
    }

    fetchStatus()
    const id = setInterval(fetchStatus, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={card}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>
          Currency
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.5rem' }}>
          Financial tools status
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '0.8125rem', color: '#991b1b', marginBottom: '0.75rem' }}>
          Unable to load status
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <ToolRow
          label="EUR→GBP Transfer fix"
          entry={data?.transferFix ?? null}
          fallback="Never run"
          subText={e => (e.pairsFixed != null ? `Fixed ${e.pairsFixed} pair${e.pairsFixed === 1 ? '' : 's'}` : null)}
        />
        <ToolRow
          label="EUR Conversion"
          entry={data?.eurConversion ?? null}
          fallback="Never run"
          subText={e => (e.converted != null ? `Converted ${e.converted} transaction${e.converted === 1 ? '' : 's'}` : null)}
        />
        <ToolRow
          label="EUR Reconciliation"
          entry={data?.reconciliation ?? null}
          fallback="Never run"
          subText={e => (e.gapAmount != null ? `Gap: ±£${e.gapAmount.toFixed(2)}` : null)}
        />
      </div>
    </div>
  )
}
