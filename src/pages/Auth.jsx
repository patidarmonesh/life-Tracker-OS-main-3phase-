import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/authContextCore'

export default function Auth() {
  const { login, user, isLoading, isAuthReady, authError } = useAuth()
  const [localError, setLocalError] = useState('')

  const handleLogin = async () => {
    try {
      setLocalError('')
      await login()
    } catch (error) {
      setLocalError(error.message || 'Sign in failed')
    }
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at top, rgba(99,102,241,0.18), transparent 35%), #020617',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(148, 163, 184, 0.16)',
          borderRadius: '24px',
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🧠</div>
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 800,
              color: 'white',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            Life OS
          </h1>
          <p
            style={{
              marginTop: '10px',
              marginBottom: 0,
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'rgba(226,232,240,0.78)',
            }}
          >
            Your personal life operating system for finance, habits, study,
            time, health, and journaling.
          </p>
        </div>

        {(authError || localError) && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(244,63,94,0.12)',
              border: '1px solid rgba(244,63,94,0.28)',
              color: '#fda4af',
              fontSize: '13px',
            }}
          >
            {authError || localError}
          </div>
        )}

        {!isAuthReady && !isLoading && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.28)',
              color: '#fcd34d',
              fontSize: '13px',
            }}
          >
            Google auth is initializing...
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading || !isAuthReady}
          style={{
            width: '100%',
            height: '48px',
            border: 'none',
            borderRadius: '14px',
            background:
              isLoading || !isAuthReady
                ? 'rgba(99,102,241,0.45)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 700,
            cursor: isLoading || !isAuthReady ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {isLoading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p
          style={{
            marginTop: '18px',
            marginBottom: 0,
            textAlign: 'center',
            fontSize: '12px',
            lineHeight: 1.6,
            color: 'rgba(148,163,184,0.85)',
          }}
        >
          Your data stays in your own Google Drive. We do not store your
          personal data on our servers.
        </p>
      </div>
    </div>
  )
}
