const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    padding: '1rem 1.5rem',
  },
  brandPlaceholder: {
    width: '160px',
    height: '14px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    width: '100%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '560px',
  },
  shimmer: {
    background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: '4px',
  },
}

export default function SetupLoading() {
  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <div style={S.brandPlaceholder} />
      </div>
      <main style={S.main}>
        <div style={S.card}>
          {/* Step label placeholder */}
          <div style={{ ...S.shimmer, height: '12px', width: '100px', marginBottom: '1rem' }} />
          {/* Heading placeholder */}
          <div style={{ ...S.shimmer, height: '28px', width: '280px', marginBottom: '0.5rem' }} />
          {/* Subtext placeholder */}
          <div style={{ ...S.shimmer, height: '14px', width: '320px', marginBottom: '1.75rem' }} />
          {/* Input row 1 */}
          <div style={{ ...S.shimmer, height: '14px', width: '120px', marginBottom: '0.375rem' }} />
          <div style={{ ...S.shimmer, height: '40px', width: '100%', marginBottom: '1.25rem' }} />
          {/* Input row 2 */}
          <div style={{ ...S.shimmer, height: '14px', width: '140px', marginBottom: '0.375rem' }} />
          <div style={{ ...S.shimmer, height: '40px', width: '100%', marginBottom: '1.5rem' }} />
          {/* Button placeholder */}
          <div style={{ ...S.shimmer, height: '40px', width: '120px' }} />
        </div>
      </main>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
