import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getDashboardStats } from '@/lib/activity-log-queries'
import { getSetting } from '@/lib/settings'
import CopyButton from '../components/CopyButton'

export const dynamic = 'force-dynamic'

const card = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}

const clickableCard = {
  ...card,
  display: 'block' as const,
  textDecoration: 'none' as const,
  color: 'inherit' as const,
  transition: 'box-shadow 0.15s',
}

export default async function DashboardPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const stats = await getDashboardStats()
  const inboundEmail = await getSetting('INBOUND_EMAIL') ?? null

  // Build date filter for "this week" links
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const fromDate = startOfWeek.toISOString().slice(0, 10)
  const toDate = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 1.25rem' }}>
        Dashboard
      </h1>

      {/* DASH-01: This week stats — clickable to open logs with filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <a href={`/logs?from=${fromDate}&to=${toDate}`} style={clickableCard}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            This Week
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>
            {stats.thisWeek.total}
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
            emails processed
          </div>
        </a>
        <a href={`/logs?status=success&from=${fromDate}&to=${toDate}`} style={clickableCard}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Success Rate
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: stats.thisWeek.rate >= 80 ? '#166534' : stats.thisWeek.rate >= 50 ? '#92400e' : '#991b1b' }}>
            {stats.thisWeek.rate}%
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
            {stats.thisWeek.successes} of {stats.thisWeek.total} succeeded
          </div>
        </a>
      </div>

      {/* DASH-02: Last transaction */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Last Transaction
        </div>
        {stats.lastTransaction ? (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
              {stats.lastTransaction.retailer}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.25rem' }}>
              {stats.lastTransaction.amount.toFixed(2)} &middot; {stats.lastTransaction.date}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              Processed {stats.lastTransaction.receivedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            No transactions yet
          </div>
        )}
      </div>

      {/* Inbound email address — from INBOUND_EMAIL Setting in DB */}
      {inboundEmail && (
        <div style={{ ...card, marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Forwarding Address
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
              whiteSpace: 'nowrap',
            }}>
              {inboundEmail}
            </code>
            <CopyButton text={inboundEmail} />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Forward order confirmation emails to this address for automatic processing
          </div>
        </div>
      )}
    </div>
  )
}
