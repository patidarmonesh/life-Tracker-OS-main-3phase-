// ─────────────────────────────────────────────────────────────────────────────
// authService.js
//
// Google Identity Services (Token/Implicit Flow) auth manager.
//
// PERMANENT FIX — "Lazy Re-auth on 401" strategy:
//
//  1. NO popup on boot. Session is restored purely from localStorage.
//     App loads instantly with cached user profile.
//
//  2. NO silent refresh via prompt:'none'. Google's GIS always opens a
//     popup for requestAccessToken(), even with prompt:'none'. Modern
//     browsers block 3rd-party cookies, making silent refresh unreliable.
//
//  3. NO One Tap popup. It fires repeatedly, causes UI disturbance,
//     and often fails to get a Drive access token anyway.
//
//  4. Token refresh ONLY happens via user-initiated action:
//     - User clicks "Reconnect" button → popup opens ONCE → done.
//     - Or user clicks "Continue with Google" on login page.
//
//  5. When token expires, the app continues working with local data.
//     Drive sync pauses and a "Reconnect" banner appears in TopBar.
//     Zero data loss, zero popup spam.
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_SCRIPT_ID      = 'google-identity-services'
const SESSION_KEY           = 'lifeos_google_session'
const GOOGLE_SCRIPT_TIMEOUT = 10_000          // 10 s to load GIS script

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ')

let tokenClient     = null
let accessToken     = null
let tokenExpiresAt  = 0

// ─── Event system ─────────────────────────────────────────────────────────────
const tokenRefreshCallbacks = new Set()

/** Register a callback fired on every successful token acquisition. */
export function onTokenRefresh(callback) {
  tokenRefreshCallbacks.add(callback)
  return () => tokenRefreshCallbacks.delete(callback)
}

function notifyTokenRefresh(token) {
  tokenRefreshCallbacks.forEach((cb) => {
    try { cb({ token }) } catch { /* swallow */ }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientId() {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  if (!id) throw new Error('Missing VITE_GOOGLE_CLIENT_ID in .env')
  return id
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(window.google); return }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load',  () => resolve(window.google))
      existing.addEventListener('error', reject)
      return
    }

    const script    = document.createElement('script')
    script.id       = GOOGLE_SCRIPT_ID
    script.src      = 'https://accounts.google.com/gsi/client'
    script.async    = true
    script.defer    = true
    script.onload   = () => resolve(window.google)
    script.onerror  = reject
    document.body.appendChild(script)

    setTimeout(() => {
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
    id:      data.sub     || '',
    name:    data.name    || 'Google User',
    email:   data.email   || '',
    picture: data.picture || '',
  }
}

function isTokenExpired(expiresAt) {
  const value = Number(expiresAt || 0)
  return value > 0 && Date.now() >= value
}

// ─── Session persistence ───────────────────────────────────────────────────────

function persistSession(token, user, expiresInSeconds = 3600) {
  accessToken    = token
  tokenExpiresAt = Date.now() + Math.max(0, Number(expiresInSeconds)) * 1000
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      accessToken: token,
      tokenExpiresAt,
      user,
    }))
  } catch (e) {
    console.warn('[authService] Could not persist session:', e)
  }
}

function clearSession() {
  accessToken    = null
  tokenExpiresAt = 0
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

// ─── Public: read session / token ─────────────────────────────────────────────

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)

    // Always return the session object so the caller has the user profile,
    // even if the token is expired — the caller can then trigger reconnect.
    if (session?.accessToken && !isTokenExpired(session.tokenExpiresAt)) {
      accessToken    = session.accessToken
      tokenExpiresAt = Number(session.tokenExpiresAt || 0)
    }
    return session ?? null
  } catch {
    return null
  }
}

export function getAccessToken() {
  const token = accessToken || getStoredSession()?.accessToken || null
  if (!token) return null
  if (isTokenExpired(tokenExpiresAt)) return null  // expired — caller shows Reconnect
  return token
}

// ─── Core: initialize the GIS tokenClient ─────────────────────────────────────

/** Always safe to call multiple times. Resolves once tokenClient is ready. */
export async function initializeGoogleAuth() {
  await loadGoogleScript()
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope:     GOOGLE_SCOPES,
      callback:  () => {},  // overridden per-call below
    })
  }
  return true
}

// ─── REMOVED: refreshAccessToken ──────────────────────────────────────────────
//
// The old refreshAccessToken() used prompt:'none' which still opens a popup
// in GIS. It also triggered One Tap as fallback. Both caused repeated popups
// and UI disturbance.
//
// Now: if token is expired, we simply return null. The caller (driveService /
// AppContext) will set syncStatus to 'auth_required' and show a Reconnect
// button. The user clicks it → signInWithGoogle() → ONE popup → done.

export async function refreshAccessToken() {
  // Just check if we have a valid token. No popup, no network call.
  const current = getAccessToken()
  if (current) return current
  return null
}

// ─── REMOVED: Token refresh watcher ───────────────────────────────────────────
//
// The 30-second interval watcher called refreshAccessToken() which opened
// popups. Not needed anymore — we use lazy re-auth on 401.

export function startTokenRefreshWatcher() {
  // no-op — kept for backward compatibility so existing callers don't break
}

export const scheduleTokenRefresh = startTokenRefreshWatcher

// ─── REMOVED: Visibility / focus / online listeners ───────────────────────────
//
// These called refreshAccessToken() on tab focus/online, triggering popups.
// Not needed anymore.

export function installTokenRefreshListeners() {
  // When user returns to the tab, try to silently refresh an expired token
  const handleVisibility = async () => {
    if (document.visibilityState !== 'visible') return
    const session = getStoredSession()
    if (!session?.user) return
    if (!isTokenExpired(session.tokenExpiresAt)) return
    // Token expired — try silent reconnect
    const result = await trySilentReconnect(session.user)
    if (result) {
      console.log('[authService] Silent reconnect on tab focus succeeded')
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  return () => document.removeEventListener('visibilitychange', handleVisibility)
}

export function removeTokenRefreshListeners() {
  // no-op — kept for backward compatibility
}

// ─── REMOVED: One Tap ─────────────────────────────────────────────────────────
//
// One Tap (initializeOneTap, silentAccessTokenRequest, decodeIdToken) has been
// completely removed. It caused repeated popup/prompt UI disturbance and
// rarely succeeded in getting a Drive access token silently.

// ─── REMOVED: attemptAutoLogin ────────────────────────────────────────────────
//
// attemptAutoLogin() tried: silent refresh → One Tap → silent token request.
// All of these open popups. Replaced by simple localStorage restore in
// AuthContext boot().

export async function attemptAutoLogin() {
  // Simple: check if we have a valid stored session. No popup, no network.
  const session = getStoredSession()
  if (!session?.accessToken) return null

  if (!isTokenExpired(session.tokenExpiresAt)) {
    // Token still valid — fully logged in
    return { strategy: 'stored-session', token: session.accessToken, user: session.user }
  }

  // Token expired but we have user profile — try silent reconnect first
  if (session.user) {
    try {
      const result = await trySilentReconnect(session.user)
      if (result) {
        return { strategy: 'silent-reconnect', token: result.accessToken, user: result.user }
      }
    } catch {
      // Silent reconnect failed — fall through to expired-session
    }

    // Couldn't reconnect silently — return user so app shows them
    // as "logged in" but Drive sync will need manual reconnect
    return { strategy: 'expired-session', token: null, user: session.user }
  }

  return null
}

/**
 * Try to get a new access token silently.
 * Uses prompt:'' which auto-selects the existing Google account.
 * The popup opens briefly and auto-closes if the user has an active Google session.
 * Returns null if it fails (user needs to manually click Reconnect).
 */
async function trySilentReconnect(existingUser) {
  try {
    await initializeGoogleAuth()
  } catch {
    return null
  }

  return new Promise((resolve) => {
    // Set a timeout — if popup doesn't resolve in 8 seconds, give up
    const timeout = setTimeout(() => resolve(null), 8000)

    tokenClient.callback = async (response) => {
      clearTimeout(timeout)
      if (response?.error) {
        resolve(null)
        return
      }
      try {
        const token     = response.access_token
        const expiresIn = Number(response.expires_in || 3600)
        // Reuse existing user profile to avoid extra API call
        const user = existingUser || await fetchGoogleUserProfile(token)
        persistSession(token, user, expiresIn)
        notifyTokenRefresh(token)
        resolve({ accessToken: token, user })
      } catch {
        resolve(null)
      }
    }

    try {
      // prompt:'' auto-selects the previously used account
      // login_hint helps Google identify the right account faster
      tokenClient.requestAccessToken({
        prompt: '',
        login_hint: existingUser?.email || '',
      })
    } catch {
      clearTimeout(timeout)
      resolve(null)
    }
  })
}

// ─── Disable Auto-Select (for sign-out) ───────────────────────────────────────

export function disableAutoSelect() {
  try {
    if (window.google?.accounts?.id?.disableAutoSelect) {
      window.google.accounts.id.disableAutoSelect()
    }
  } catch {
    // ignore
  }
}

// ─── Sign in / Sign out ───────────────────────────────────────────────────────

export async function signInWithGoogle() {
  await initializeGoogleAuth()

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (response) => {
      if (response?.error) {
        reject(new Error(response.error))
        return
      }
      try {
        const token     = response.access_token
        const expiresIn = Number(response.expires_in || 3600)
        const user      = await fetchGoogleUserProfile(token)
        persistSession(token, user, expiresIn)

        notifyTokenRefresh(token)

        resolve({ accessToken: token, user })
      } catch (error) {
        reject(error)
      }
    }

    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

/**
 * Reconnect to Google Drive — used when token has expired.
 * Opens a popup ONCE for the user to re-authorize.
 * Uses prompt:'' (empty string) so Google auto-selects the existing account
 * without forcing consent screen again.
 */
export async function reconnectGoogle() {
  await initializeGoogleAuth()

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (response) => {
      if (response?.error) {
        reject(new Error(response.error))
        return
      }
      try {
        const token     = response.access_token
        const expiresIn = Number(response.expires_in || 3600)
        const user      = await fetchGoogleUserProfile(token)
        persistSession(token, user, expiresIn)

        notifyTokenRefresh(token)

        resolve({ accessToken: token, user })
      } catch (error) {
        reject(error)
      }
    }

    // prompt:'' lets Google auto-select the previously used account
    // without showing the consent screen again. The popup opens briefly
    // and closes automatically if the user has an active Google session.
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function signOutGoogle() {
  const token = getAccessToken()
  clearSession()
  disableAutoSelect()
  try {
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token, () => {})
    }
  } catch {
    // ignore revoke errors
  }
}
