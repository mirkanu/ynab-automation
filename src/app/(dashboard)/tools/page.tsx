import { getSetting } from '@/lib/settings'
import SettingsForm from '../settings/SettingsForm'
import TestParseForm from './TestParseForm';

export const dynamic = 'force-dynamic';

export default async function ToolsPage() {
  const testModeValue = await getSetting('TEST_MODE')
  const testMode = testModeValue === 'true'

  let defaultSenderName = 'Test';
  try {
    const senders = JSON.parse(process.env.SENDERS ?? '[]') as Array<{ name?: string }>;
    if (senders[0]?.name) defaultSenderName = senders[0].name;
  } catch { /* use default */ }

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
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
