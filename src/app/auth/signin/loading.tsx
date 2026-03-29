export default function SignInLoading() {
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
          width: '320px',
          height: '40px',
          background: '#e5e7eb',
          borderRadius: '6px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          width: '320px',
          height: '40px',
          background: '#e5e7eb',
          borderRadius: '6px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    </div>
  )
}
