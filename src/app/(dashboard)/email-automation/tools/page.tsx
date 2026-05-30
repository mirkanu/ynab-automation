import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getSetting } from '@/lib/settings'
import SettingsForm from '../../settings/SettingsForm'
import TestParseForm from '../../tools/TestParseForm'

export const dynamic = 'force-dynamic'

export default async function ToolsPage() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const testModeValue = await getSetting('TEST_MODE')
  const testMode = testModeValue === 'true'

  let defaultSenderName = 'Test';
  try {
    const raw = JSON.parse(process.env.SENDERS ?? '[]');
    if (Array.isArray(raw)) {
      const firstName = raw[0];
      if (
        firstName !== null &&
        typeof firstName === 'object' &&
        typeof firstName.name === 'string' &&
        firstName.name.length > 0 &&
        firstName.name.length <= 100
      ) {
        defaultSenderName = firstName.name;
      }
    }
  } catch { /* use default */ }

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        Tools
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
        Toggle test mode and test email parsing or replay transactions.
      </p>
      <SettingsForm testMode={testMode} />
      <TestParseForm defaultSenderName={defaultSenderName} />
    </div>
  );
}
