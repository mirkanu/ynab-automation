import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getSetting } from '@/lib/settings'
import SenderRulesSection from '../settings/SenderRulesSection'
import CurrencyRulesSection from '../settings/CurrencyRulesSection'

export const dynamic = 'force-dynamic'

export default async function RulesPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const budgetId = await getSetting('YNAB_BUDGET_ID')
  const connected = !!budgetId

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        Rules
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        Configure sender and currency routing rules.
      </p>

      <SenderRulesSection connected={connected} initialBudgetId={budgetId ?? null} />

      <CurrencyRulesSection connected={connected} initialBudgetId={budgetId ?? null} />
    </div>
  )
}
