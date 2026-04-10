import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getSetting } from '@/lib/settings'
import SettingsForm from './SettingsForm'
import SenderRulesSection from './SenderRulesSection'
import CurrencyRulesSection from './CurrencyRulesSection'
import { AdminPasswordSection } from './AdminPasswordSection'
import ApiKeysSection from './ApiKeysSection'
import YnabConnectionSection from './YnabConnectionSection'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const testModeValue = await getSetting('TEST_MODE')
  const testMode = testModeValue === 'true'

  const budgetId = await getSetting('YNAB_BUDGET_ID')
  const connected = !!budgetId

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        Settings
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        Manage your account settings and preferences.
      </p>

      {/* 1. Email Processing (test mode toggle) */}
      <SettingsForm testMode={testMode} />

      {/* 2. API Keys */}
      <ApiKeysSection />

      {/* 3. YNAB Connection (PAT + budget/account dropdowns) */}
      <YnabConnectionSection />

      {/* 4. Sender Routing Rules */}
      <SenderRulesSection connected={connected} initialBudgetId={budgetId ?? null} />

      {/* 5. Currency Routing */}
      <CurrencyRulesSection connected={connected} initialBudgetId={budgetId ?? null} />

      {/* 6. Admin Password */}
      <AdminPasswordSection />
    </div>
  )
}
