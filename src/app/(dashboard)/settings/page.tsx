import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { AdminPasswordSection } from './AdminPasswordSection'
import ApiKeysSection from './ApiKeysSection'
import YnabConnectionSection from './YnabConnectionSection'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        Settings
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        Manage your account settings and preferences.
      </p>

      {/* 1. API Keys */}
      <ApiKeysSection />

      {/* 2. YNAB Connection (PAT + budget/account dropdowns) */}
      <YnabConnectionSection />

      {/* 3. Admin Password */}
      <AdminPasswordSection />
    </div>
  )
}
