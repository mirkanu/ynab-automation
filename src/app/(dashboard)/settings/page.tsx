import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import SettingsForm from './SettingsForm';
import YnabConnectionSection from './YnabConnectionSection';
import SenderRulesSection from './SenderRulesSection';
import DangerZone from './DangerZone';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Load YNAB connection status, current selection, and per-user settings from DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      oauthToken: true,
      selectedBudgetId: true,
      selectedAccountId: true,
      testMode: true,
      forwardingEmail: true,
      email: true,
    },
  });

  const ynabConnected = !!user?.oauthToken;

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
        Settings
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
        Manage your account settings and preferences.
      </p>

      <YnabConnectionSection
        connected={ynabConnected}
        initialBudgetId={user?.selectedBudgetId}
        initialAccountId={user?.selectedAccountId}
      />

      <SenderRulesSection
        connected={ynabConnected}
        initialBudgetId={user?.selectedBudgetId}
      />

      <SettingsForm
        testMode={user?.testMode ?? false}
        forwardingEmail={user?.forwardingEmail ?? null}
      />

      <DangerZone />
    </div>
  );
}
