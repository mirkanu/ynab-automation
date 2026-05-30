import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import ReconcileEurWiseCard from '../../tools/ReconcileEurWiseCard'

export const dynamic = 'force-dynamic'

export default async function ReconciliationPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        EUR Reconciliation
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        Reconcile the €Wise Euro YNAB account against the live Wise EUR balance.
      </p>
      <ReconcileEurWiseCard />
    </div>
  )
}
