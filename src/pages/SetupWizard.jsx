import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SetupWizard() {
  const [step, setStep] = useState(1)
  const [clientId, setClientId] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const hasEnvClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID !== undefined && import.meta.env.VITE_GOOGLE_CLIENT_ID.trim() !== ''

  const handleSave = () => {
    if (!clientId.trim().endsWith('.apps.googleusercontent.com')) {
      setError('Client ID must end with .apps.googleusercontent.com')
      return
    }
    
    setError('')
    localStorage.setItem('lifeos_google_client_id', clientId.trim())
    
    if (geminiKey.trim()) {
      localStorage.setItem('lifeos_gemini_api_key', geminiKey.trim())
    }
    
    setStep(4)
  }

  const handleSkip = () => {
    setStep(4)
  }

  const origin = window.location.origin

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at top, rgba(99,102,241,0.18), transparent 35%), #020617',
        padding: '24px',
        fontFamily: 'DM Sans, sans-serif',
        color: 'white'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(148, 163, 184, 0.16)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>🧠</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800, margin: '0 0 16px 0' }}>
              Welcome to Life OS
            </h1>
            <p style={{ fontSize: '16px', color: 'rgba(226,232,240,0.8)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
              Let's set up your personal workspace. You'll need to configure your own Google Cloud project to keep your data private and entirely under your control.
            </p>
            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%',
                height: '52px',
                border: 'none',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.2s, opacity 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              Get Started
            </button>
          </div>
        )}

        {/* Step 2: Google Cloud Setup Guide */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', textAlign: 'center' }}>
              Google Cloud Setup
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(226,232,240,0.7)', margin: '0 0 24px 0', textAlign: 'center' }}>
              Follow these steps to generate your OAuth Client ID
            </p>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'rgba(226,232,240,0.9)', lineHeight: 1.5 }}>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: '#818CF8', textDecoration: 'none', fontWeight: 600 }}>console.cloud.google.com</a></li>
                <li>Create a new project or select an existing one</li>
                <li>Go to <strong>APIs & Services → Library</strong></li>
                <li>Search for and enable <strong>Google Drive API</strong></li>
                <li>Go to <strong>APIs & Services → Credentials</strong></li>
                <li>Click <strong>Create Credentials → OAuth 2.0 Client ID</strong> (you may need to configure the consent screen first)</li>
                <li>Application type: <strong>Web application</strong></li>
                <li>Add Authorized JavaScript Origins: <code style={{ background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: '4px', color: '#A5B4FC' }}>{origin}</code></li>
                <li>Add Authorized redirect URIs: <code style={{ background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: '4px', color: '#A5B4FC' }}>{origin}</code></li>
                <li>Click <strong>Create</strong> and copy your Client ID</li>
              </ol>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, height: '48px', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '14px',
                  background: 'transparent', color: 'white', fontSize: '15px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 2, height: '48px', border: 'none', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Paste Credentials */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', textAlign: 'center' }}>
              Enter Credentials
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(226,232,240,0.7)', margin: '0 0 24px 0', textAlign: 'center' }}>
              These are saved locally on your device
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(148,163,184,1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Google OAuth Client ID <span style={{ color: '#F43F5E' }}>*</span>
                </label>
                <input
                  value={clientId}
                  onChange={e => { setClientId(e.target.value); setError('') }}
                  placeholder="xxxxxxxxx.apps.googleusercontent.com"
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: '12px',
                    background: 'rgba(0,0,0,0.2)', border: `1px solid ${error ? '#F43F5E' : 'rgba(148,163,184,0.2)'}`,
                    color: 'white', fontSize: '14px', outline: 'none', fontFamily: 'monospace'
                  }}
                />
                {error && <div style={{ color: '#F43F5E', fontSize: '12px', marginTop: '6px' }}>{error}</div>}
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(148,163,184,1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Gemini API Key <span style={{ color: 'rgba(148,163,184,0.6)', textTransform: 'none', fontWeight: 500 }}>(Optional)</span>
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: '12px',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(148,163,184,0.2)',
                    color: 'white', fontSize: '14px', outline: 'none', fontFamily: 'monospace'
                  }}
                />
                <div style={{ fontSize: '12px', color: 'rgba(148,163,184,0.7)', marginTop: '6px' }}>
                  Get from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: '#818CF8', textDecoration: 'none' }}>aistudio.google.com → API keys</a>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1, height: '48px', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '14px',
                    background: 'transparent', color: 'white', fontSize: '15px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    flex: 2, height: '48px', border: 'none', borderRadius: '14px',
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Save & Continue
                </button>
              </div>
              {hasEnvClientId && (
                <button
                  onClick={handleSkip}
                  style={{
                    background: 'none', border: 'none', color: 'rgba(148,163,184,0.8)', fontSize: '14px', cursor: 'pointer', padding: '8px'
                  }}
                >
                  Skip for Now (using default environment key)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', 
              display: 'grid', placeItems: 'center', margin: '0 auto 24px auto'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800, margin: '0 0 12px 0' }}>
              You're all set!
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(226,232,240,0.8)', margin: '0 0 32px 0' }}>
              Your environment is ready. Let's get started.
            </p>
            <button
              onClick={() => navigate('/auth')}
              style={{
                width: '100%', height: '52px', border: 'none', borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Continue to Login
            </button>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
