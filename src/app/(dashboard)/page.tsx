import SetupWizard from '../setup/SetupWizard';

export default function DashboardPage() {
  const isConfigured = !!process.env.SENDERS;

  if (!isConfigured) {
    return <SetupWizard />;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827', margin: '0 0 0.5rem' }}>
        Dashboard
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
        YNAB Automation is running. Activity logs and settings coming in future phases.
      </p>
    </div>
  );
}
