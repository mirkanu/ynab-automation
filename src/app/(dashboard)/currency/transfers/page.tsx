import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import FixEurGbpTransfersCard from '../../tools/FixEurGbpTransfersCard'

export const dynamic = 'force-dynamic'

export default async function TransfersPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        EUR→GBP Transfers
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        Detect and fix unmatched EUR→GBP transfer pairs in YNAB.
      </p>
      <FixEurGbpTransfersCard />
    </div>
  )
}
