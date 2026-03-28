export default function SettingsLoading() {
  const shimmer = {
    backgroundColor: '#e5e7eb',
    borderRadius: '6px',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  const section = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1.5rem',
  };

  return (
    <div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* Page title skeleton */}
      <div style={{ ...shimmer, width: '120px', height: '1.375rem', marginBottom: '0.5rem' }} />
      <div style={{ ...shimmer, width: '360px', height: '0.875rem', marginBottom: '1.5rem' }} />

      {/* Section 1: Sender Routing skeleton */}
      <div style={section}>
        <div style={{ ...shimmer, width: '160px', height: '1.125rem', marginBottom: '0.5rem' }} />
        <div style={{ ...shimmer, width: '320px', height: '0.8125rem', marginBottom: '1.25rem' }} />
        <div style={{ ...shimmer, height: '180px', marginBottom: '0.75rem' }} />
        <div style={{ ...shimmer, height: '180px' }} />
      </div>

      {/* Section 2: Currency Routing skeleton */}
      <div style={section}>
        <div style={{ ...shimmer, width: '180px', height: '1.125rem', marginBottom: '0.5rem' }} />
        <div style={{ ...shimmer, width: '300px', height: '0.8125rem', marginBottom: '1.25rem' }} />
        <div style={{ ...shimmer, height: '40px' }} />
      </div>

      {/* Section 3: API Keys skeleton */}
      <div style={section}>
        <div style={{ ...shimmer, width: '100px', height: '1.125rem', marginBottom: '0.5rem' }} />
        <div style={{ ...shimmer, width: '280px', height: '0.8125rem', marginBottom: '1.25rem' }} />
        <div style={{ ...shimmer, height: '40px', marginBottom: '0.625rem' }} />
        <div style={{ ...shimmer, height: '40px', marginBottom: '0.625rem' }} />
        <div style={{ ...shimmer, height: '40px' }} />
      </div>

      {/* Section 4: Other Settings skeleton */}
      <div style={section}>
        <div style={{ ...shimmer, width: '140px', height: '1.125rem', marginBottom: '0.5rem' }} />
        <div style={{ ...shimmer, width: '240px', height: '0.8125rem', marginBottom: '1.25rem' }} />
        <div style={{ ...shimmer, height: '40px', marginBottom: '0.625rem' }} />
        <div style={{ ...shimmer, height: '40px', marginBottom: '0.625rem' }} />
        <div style={{ ...shimmer, height: '40px' }} />
      </div>
    </div>
  );
}
