import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/appContextCore'

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

  // Show a clean auto-login screen while boot() is running
  const isAutoLogging = isLoading || !isAuthReady

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

        {/* Auto-login in progress — show pulse animation */}
        {isAutoLogging && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              padding: '20px 0',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                animation: 'authPulse 1.5s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontSize: '14px',
                color: 'rgba(148,163,184,0.9)',
                fontWeight: 500,
              }}
            >
              Connecting...
            </span>
            <style>{`
              @keyframes authPulse {
                0%, 100% { transform: scale(1); opacity: 0.7; }
                50% { transform: scale(1.15); opacity: 1; }
              }
            `}</style>
          </div>
        )}

        {/* Errors */}
        {!isAutoLogging && (authError || localError) && (
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

        {/* Login button — only visible after auto-login completes */}
        {!isAutoLogging && (
          <button
            onClick={handleLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              height: '48px',
              border: 'none',
              borderRadius: '14px',
              background: isLoading
                ? 'rgba(99,102,241,0.45)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </button>
        )}

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

