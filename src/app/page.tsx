import SetupWizard from './setup/SetupWizard';

export default function RootPage() {
  const isConfigured = !!process.env.SENDERS;

  if (isConfigured) {
    return (
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#f9fafb',
      }}>
        <div style={{ textAlign: 'center', color: '#374151' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            YNAB Automation is running
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            Forward an order confirmation email to your Pipedream address to create a YNAB transaction.
          </p>
        </div>
      </div>
    );
  }

  return <SetupWizard />;
}
