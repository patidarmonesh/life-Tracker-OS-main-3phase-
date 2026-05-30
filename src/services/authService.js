const GOOGLE_SCRIPT_ID = 'google-identity-services'
const SESSION_KEY = 'lifeos_google_session'
const REDIRECT_STATE_KEY = 'lifeos_google_redirect_state'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCRIPT_TIMEOUT = 8000

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ')

let tokenClient = null
let accessToken = null

function getClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID in .env')
  }
  return clientId
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google)
      return
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google))
      existing.addEventListener('error', reject)
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = reject
    document.body.appendChild(script)

    window.setTimeout(() => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google auth script timed out'))
      }
    }, GOOGLE_SCRIPT_TIMEOUT)
  })
}

async function fetchGoogleUserProfile(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error('Failed to fetch Google profile')

  const data = await res.json()

  return {
    id: data.sub || '',
    name: data.name || 'Google User',
    email: data.email || '',
    picture: data.picture || '',
  }
}

function persistSession(token, user) {
  accessToken = token
  localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: token, user }))
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`
}

function createRedirectState() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cleanAuthHash() {
  window.history.replaceState(
    null,
    document.title,
    `${window.location.pathname}${window.location.search}`
  )
}

export async function completeGoogleRedirectSignIn() {
  if (!window.location.hash.includes('access_token=')) return null

  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('access_token')
  const state = params.get('state')
  const expectedState = sessionStorage.getItem(REDIRECT_STATE_KEY)

  if (!token) throw new Error('Missing access token')
  if (expectedState && state !== expectedState) {
    throw new Error('Invalid redirect state')
  }

  sessionStorage.removeItem(REDIRECT_STATE_KEY)
  cleanAuthHash()

  const user = await fetchGoogleUserProfile(token)
  persistSession(token, user)
  return user
}
