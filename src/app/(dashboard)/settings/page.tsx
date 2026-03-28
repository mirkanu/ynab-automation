import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  // Parse current SENDERS from env
  let currentSenders: Array<{ email: string; name: string; accountId: string; notificationLabel?: string }> = [];
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
  };

  const currentOther = {
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    inboundEmail: process.env.INBOUND_EMAIL ?? '',
    budgetId: process.env.YNAB_BUDGET_ID ?? '',
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        Settings
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        View and edit all configuration. Changes are applied to Railway and take effect after a redeploy.
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
