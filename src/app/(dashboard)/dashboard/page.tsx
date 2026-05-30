import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getDashboardStats } from '@/lib/activity-log-queries'
import { getSetting } from '@/lib/settings'
import CopyButton from '../components/CopyButton'
import CurrencyPanel from './CurrencyPanel'

export const dynamic = 'force-dynamic'

const card = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}

export default async function DashboardPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const stats = await getDashboardStats()
  const inboundEmail = await getSetting('INBOUND_EMAIL') ?? null

  const rateColor =
    stats.thisWeek.rate >= 80 ? '#166534' :
    stats.thisWeek.rate >= 50 ? '#92400e' : '#991b1b'

  const lastEmailFormatted = stats.lastEmailReceivedAt
    ? stats.lastEmailReceivedAt.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null

  const lastTransactionFormatted = stats.lastTransaction
    ? stats.lastTransaction.receivedAt.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 1.25rem' }}>
        Dashboard
      </h1>

      {/* Two-panel grid: Email Automation + Currency */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem',
      }}>

        {/* DASH-03: Email Automation panel */}
        <div style={card}>
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>
              Email Automation
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Email processing summary
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Row 1: Last email processed */}
            <div>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Last email processed
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#374151', marginTop: '0.25rem' }}>
                {lastEmailFormatted ?? 'No emails processed yet'}
              </div>
            </div>

            {/* Row 2: Success rate */}
            <div>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Success rate (this week)
              </div>
              {stats.thisWeek.total > 0 ? (
                <div style={{ fontSize: '0.8125rem', color: rateColor, marginTop: '0.25rem' }}>
                  {stats.thisWeek.rate}% ({stats.thisWeek.successes}/{stats.thisWeek.total})
                </div>
              ) : (
                <div style={{ fontSize: '0.8125rem', color: '#374151', marginTop: '0.25rem' }}>
                  No emails this week
                </div>
              )}
            </div>

            {/* Row 3: Last YNAB transaction */}
            <div>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Last YNAB transaction
              </div>
              {stats.lastTransaction ? (
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.8125rem', color: '#374151' }}>
                    {stats.lastTransaction.retailer}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#374151' }}>
                    £{stats.lastTransaction.amount.toFixed(2)} · {lastTransactionFormatted}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8125rem', color: '#374151', marginTop: '0.25rem' }}>
                  No transactions created yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DASH-04: Currency panel (client component — polls every 5s) */}
        <CurrencyPanel />
      </div>

      {/* Forwarding Address card — from Phase 28, preserved below panels (DASH-02 / FWD-01) */}
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
