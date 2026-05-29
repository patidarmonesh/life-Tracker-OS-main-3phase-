const GOOGLE_SCRIPT_ID = 'google-identity-services'
const SESSION_KEY = 'lifeos_google_session'

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

export async function initializeGoogleAuth() {
  const google = await loadGoogleScript()
  const clientId = getClientId()

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPES,
    callback: () => {},
  })

  return true
}

export function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2 || !tokenClient) {
      reject(new Error('Google auth not initialized'))
      return
    }

    tokenClient.callback = async tokenResponse => {
      try {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error))
          return
        }

        const token = tokenResponse.access_token
        if (!token) {
          reject(new Error('No access token received'))
          return
        }

        const user = await fetchGoogleUserProfile(token)
        persistSession(token, user)
        resolve({ accessToken: token, user })
      } catch (error) {
        reject(error)
      }
    }

    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

export function refreshAccessToken() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2 || !tokenClient) {
      reject(new Error('Google auth not initialized'))
      return
    }

    tokenClient.callback = async tokenResponse => {
      try {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error))
          return
        }

        const token = tokenResponse.access_token
        if (!token) {
          reject(new Error('No access token received'))
          return
        }

        const session = getStoredSession()
        const user = session?.user || (await fetchGoogleUserProfile(token))
        persistSession(token, user)
        resolve(token)
      } catch (error) {
        reject(error)
      }
    }

    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    accessToken = parsed.accessToken || null
    return parsed
  } catch {
    return null
  }
}

export function getAccessToken() {
  if (accessToken) return accessToken
  return getStoredSession()?.accessToken || null
}

export function signOutGoogle() {
  const session = getStoredSession()
  const token = session?.accessToken || accessToken

  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {})
  }

  accessToken = null
  localStorage.removeItem(SESSION_KEY)
}
