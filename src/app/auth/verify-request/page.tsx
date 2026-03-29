export default function VerifyRequestPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '360px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
        <h1
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '0.5rem',
          }}
        >
          Check your email
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '1.5rem',
            lineHeight: '1.5',
          }}
        >
          A magic sign-in link has been sent to your email address. Click the link to sign in.
        </p>
        <a
          href="/auth/signin"
          style={{
            fontSize: '0.8125rem',
            color: '#6b7280',
            textDecoration: 'underline',
          }}
        >
          Back to sign in
        </a>
      </div>
    </div>
  )
}
