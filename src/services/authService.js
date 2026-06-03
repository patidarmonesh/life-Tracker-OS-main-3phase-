const GOOGLE_SCRIPT_ID = 'google-identity-services'
const SESSION_KEY = 'lifeos_google_session'
const GOOGLE_SCRIPT_TIMEOUT = 8000
const TOKEN_SKEW_MS = 60_000
const REFRESH_INTERVAL_MS = 40 * 60 * 1000 // 40 minutes — refresh well before the 60-min expiry

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ')

let tokenClient = null
let accessToken = null
let tokenExpiresAt = 0
let refreshTimerId = null

// ---------------------------------------------------------------------------
// Event system – subscribers are notified whenever a token is refreshed
// ---------------------------------------------------------------------------
const tokenRefreshCallbacks = new Set()

/**
 * Register a callback that fires whenever the access token is refreshed.
 * Returns an unsubscribe function.
 *
 * @param {(token: string) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onTokenRefresh(callback) {
  tokenRefreshCallbacks.add(callback)
  return () => tokenRefreshCallbacks.delete(callback)
}

function notifyTokenRefresh(token) {
  tokenRefreshCallbacks.forEach((cb) => {
    try {
      cb({ token })
    } catch {
      // swallow subscriber errors so one bad listener can't break the loop
    }
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function isTokenExpired(expiresAt) {
  const value = Number(expiresAt || 0)
  return value > 0 && Date.now() >= value - TOKEN_SKEW_MS
}

function persistSession(token, user, expiresInSeconds = 3600) {
  accessToken = token
  tokenExpiresAt = Date.now() + Math.max(0, Number(expiresInSeconds)) * 1000
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: token,
      tokenExpiresAt,
      user,
    })
  )
}

function clearSession() {
  accessToken = null
  tokenExpiresAt = 0
  localStorage.removeItem(SESSION_KEY)
  clearRefreshTimer()
}

// ---------------------------------------------------------------------------
// Proactive silent refresh
// ---------------------------------------------------------------------------

function clearRefreshTimer() {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId)
    refreshTimerId = null
  }
}

/**
 * Schedule a silent token refresh 50 minutes after the last successful
 * token acquisition.  Uses `prompt: ''` so the user never sees a popup —
 * consent was already granted during the initial sign-in.
 */
export function scheduleTokenRefresh() {
  clearRefreshTimer()

  refreshTimerId = setTimeout(async () => {
    refreshTimerId = null
    if (!tokenClient) return

    try {
      await initializeGoogleAuth()

      const refreshed = await new Promise((resolve) => {
        // Temporarily swap the callback for the silent refresh attempt
        const prevCallback = tokenClient.callback
        tokenClient.callback = async (response) => {
          // Restore the previous callback immediately
          tokenClient.callback = prevCallback

          if (response?.error) {
            console.warn('[authService] Silent token refresh failed:', response.error)
            resolve(null)
            return
          }

          try {
            const token = response.access_token
            const expiresIn = Number(response.expires_in || 3600)
            const user = await fetchGoogleUserProfile(token)
            persistSession(token, user, expiresIn)
            resolve(token)
          } catch (err) {
            console.warn('[authService] Silent refresh profile fetch failed:', err)
            resolve(null)
          }
        }

        tokenClient.requestAccessToken({ prompt: '' })
      })

      if (refreshed) {
        notifyTokenRefresh(refreshed)
        scheduleTokenRefresh() // schedule the next one
      }
    } catch (err) {
      console.warn('[authService] Silent refresh error:', err)
    }
  }, REFRESH_INTERVAL_MS)
}

// ---------------------------------------------------------------------------
// Visibility / focus / network-reconnect listeners
// ---------------------------------------------------------------------------
// When the user returns to a backgrounded tab (where setTimeout may have been
// throttled or skipped entirely), immediately attempt a silent token refresh
// so Drive calls don't fail with a stale token.

let _eventListenersInstalled = false

function _onFocusOrVisible() {
  // Only act when the page is actually visible
  if (document.visibilityState === 'hidden') return
  refreshAccessToken().catch(() => {
    // best-effort — caller-level Drive code will handle the failure
  })
}

function _onOnline() {
  refreshAccessToken().catch(() => {})
}

export function installTokenRefreshListeners() {
  if (_eventListenersInstalled) return
  _eventListenersInstalled = true

  window.addEventListener('focus', _onFocusOrVisible)
  document.addEventListener('visibilitychange', _onFocusOrVisible)
  window.addEventListener('online', _onOnline)
}

export function removeTokenRefreshListeners() {
  if (!_eventListenersInstalled) return
  _eventListenersInstalled = false

  window.removeEventListener('focus', _onFocusOrVisible)
  document.removeEventListener('visibilitychange', _onFocusOrVisible)
  window.removeEventListener('online', _onOnline)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)

    // Even if the token is expired we still return the session so the caller
    // can use the user profile and attempt a silent refresh.  Previously this
    // called clearSession() on expiry which destroyed the user object and made
    // it impossible to recover without a full re-login.
    if (session?.accessToken && !isTokenExpired(session.tokenExpiresAt)) {
      accessToken = session.accessToken
      tokenExpiresAt = Number(session.tokenExpiresAt || 0)
    }
    return session
  } catch {
    return null
  }
}

export function getAccessToken() {
  const token = accessToken || getStoredSession()?.accessToken || null
  if (!token) return null
  if (isTokenExpired(tokenExpiresAt)) {
    return null
  }
  return token
}

export async function initializeGoogleAuth() {
  await loadGoogleScript()
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: GOOGLE_SCOPES,
      callback: () => {},
    })
  }
  return true
}

/**
 * Attempt a **silent** token refresh (no popup).
 * Returns the new token on success, or `null` if the silent attempt fails.
 */
export async function refreshAccessToken() {
  // If we already have a valid token, return it immediately
  const currentToken = getAccessToken()
  if (currentToken) return currentToken

  // Try a silent refresh — prompt: '' avoids a consent popup
  try {
    await initializeGoogleAuth()

    const token = await new Promise((resolve) => {
      const prevCallback = tokenClient.callback
      tokenClient.callback = async (response) => {
        tokenClient.callback = prevCallback

        if (response?.error) {
          resolve(null)
          return
        }

        try {
          const tk = response.access_token
          const expiresIn = Number(response.expires_in || 3600)
          const user = await fetchGoogleUserProfile(tk)
          persistSession(tk, user, expiresIn)
          resolve(tk)
        } catch {
          resolve(null)
        }
      }

      tokenClient.requestAccessToken({ prompt: '' })
    })

    if (token) {
      notifyTokenRefresh(token)
      scheduleTokenRefresh()
    }

    return token
  } catch {
    return null
  }
}

export async function signInWithGoogle() {
  await initializeGoogleAuth()
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (response) => {
      if (response?.error) {
        reject(new Error(response.error))
        return
      }
      try {
        const token = response.access_token
        const expiresIn = Number(response.expires_in || 3600)
        const user = await fetchGoogleUserProfile(token)
        persistSession(token, user, expiresIn)

        // Notify subscribers & schedule the next silent refresh
        notifyTokenRefresh(token)
        scheduleTokenRefresh()

        resolve({ accessToken: token, user })
      } catch (error) {
        reject(error)
      }
    }
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

export function signOutGoogle() {
  const token = getAccessToken()
  clearSession() // also clears the refresh timer
  try {
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token, () => {})
    }
  } catch {
    // ignore revoke errors
  }
}
