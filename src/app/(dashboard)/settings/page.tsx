import SettingsForm from './SettingsForm';
import { loadDbSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await loadDbSettings();
  // Parse current SENDERS from env
  let currentSenders: Array<{ email: string; name: string; accountId: string }> = [];
  try {
    currentSenders = JSON.parse(process.env.SENDERS ?? '[]');
  } catch {
    currentSenders = [];
  }

  // Parse current CURRENCY_ACCOUNTS from env
  let currentCurrencyAccounts: Record<string, string> = {};
  try {
    currentCurrencyAccounts = JSON.parse(process.env.CURRENCY_ACCOUNTS ?? '{}');
  } catch {
    currentCurrencyAccounts = {};
  }

  const currentApiKeys = {
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    ynabToken: process.env.YNAB_PERSONAL_ACCESS_TOKEN ?? '',
    resendKey: process.env.RESEND_API_KEY ?? '',
    railwayToken: process.env.RAILWAY_API_TOKEN ?? '',
  };

  const currentOther = {
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    inboundEmail: process.env.INBOUND_EMAIL ?? '',
    budgetId: process.env.YNAB_BUDGET_ID ?? '',
    testMode: process.env.TEST_MODE === 'true',
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        Settings
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        View and edit all configuration. Changes take effect immediately.
      </p>
      <SettingsForm
        currentSenders={currentSenders}
        currentCurrencyAccounts={currentCurrencyAccounts}
        currentApiKeys={currentApiKeys}
        currentOther={currentOther}
      />
    </div>
  );
}
