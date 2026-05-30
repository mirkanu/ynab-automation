import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'

export const dynamic = 'force-dynamic'

export default async function ConversionPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        EUR Conversion
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        Bulk-convert EUR transactions to GBP using historical exchange rates. Coming soon.
      </p>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '2rem',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '0.875rem',
      }}>
        EUR Conversion tool not yet available. Check back after Phase 33.
      </div>
    </div>
  )
}
