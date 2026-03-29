export default function VerifyRequestLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: '280px',
          height: '24px',
          background: '#e5e7eb',
          borderRadius: '4px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          width: '200px',
          height: '16px',
          background: '#e5e7eb',
          borderRadius: '4px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    </div>
  )
}
