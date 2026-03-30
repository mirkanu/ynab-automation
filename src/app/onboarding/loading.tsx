export default function OnboardingLoading() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ height: '2rem', background: '#f3f4f6', borderRadius: '8px', marginBottom: '1rem', width: '60%' }} />
      <div style={{ height: '1rem', background: '#f3f4f6', borderRadius: '4px', marginBottom: '2rem', width: '80%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '80px', background: '#f3f4f6', borderRadius: '12px' }} />
        ))}
      </div>
    </div>
  )
}
