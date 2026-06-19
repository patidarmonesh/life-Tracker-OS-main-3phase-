// ─────────────────────────────────────────────────────────────────────────────
// authService.js
//
// Google Identity Services (Token/Implicit Flow) auth manager.
//
// Key design choices vs. the previous version:
//
//  1. We use a setInterval watcher (every 30 s) instead of a single setTimeout.
//     Background tabs throttle long timers heavily, so a 40-min setTimeout can
//     fire 5-10 min late and the token is already dead.
//
//  2. We schedule refresh at (tokenExpiresAt - REFRESH_AHEAD_MS) rather than
//     "40 min from now".  This handles restores where the token only has
//     5 minutes left.
//
//  3. We await initializeGoogleAuth() before attempting any silent refresh, so
//     tokenClient is always ready when we need it.
//
//  4. We use prompt:'none' (the correct GIS silent value) instead of prompt:''.
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_SCRIPT_ID      = 'google-identity-services'
const SESSION_KEY           = 'lifeos_google_session'
const GOOGLE_SCRIPT_TIMEOUT = 10_000          // 10 s to load GIS script

// How far ahead of expiry we proactively refresh
const REFRESH_AHEAD_MS = 5 * 60 * 1000       // 5 minutes

// How often the watcher loop checks whether a refresh is needed.
// Short enough to catch throttled timers, long enough not to waste CPU.
const WATCHER_INTERVAL_MS = 30_000            // 30 seconds

// A refresh is "in flight" — don't start a second concurrent one
let _refreshInFlight = false

// Debounce: don't attempt more than one silent refresh per this window
const REFRESH_DEBOUNCE_MS = 10_000           // 10 seconds
let _lastRefreshAttempt = 0

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ')

let tokenClient     = null
let accessToken     = null
let tokenExpiresAt  = 0
let _watcherTimerId = null
let _oneTapInitialized = false

// ─── Event system ─────────────────────────────────────────────────────────────
const tokenRefreshCallbacks = new Set()

/** Register a callback fired on every successful silent token refresh. */
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

function isTokenNearExpiry(expiresAt) {
  const value = Number(expiresAt || 0)
  if (value <= 0) return false
  return Date.now() >= value - REFRESH_AHEAD_MS
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
  stopTokenRefreshWatcher()
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

// ─── Public: read session / token ─────────────────────────────────────────────

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)

    // Always return the session object so the caller has the user profile,
    // even if the token is expired — the caller can then trigger a silent refresh.
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
  if (isTokenExpired(tokenExpiresAt)) return null  // expired — callers must refresh
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

// ─── Core: silent token refresh ───────────────────────────────────────────────

/**
 * Attempt a silent token refresh.
 * - Uses prompt:'none' (correct GIS silent value).
 * - Awaits initializeGoogleAuth() first, so tokenClient is always ready.
 * - Deduplicates concurrent calls.
 * Returns the new token string, or null on failure.
 */
export async function refreshAccessToken() {
  // Return existing valid token immediately
  const current = getAccessToken()
  if (current && !isTokenNearExpiry(tokenExpiresAt)) return current

  // Debounce
  const now = Date.now()
  if (_refreshInFlight) return null
  if (now - _lastRefreshAttempt < REFRESH_DEBOUNCE_MS) return null

  _refreshInFlight       = true
  _lastRefreshAttempt    = now

  try {
    // ← KEY FIX: always await init before using tokenClient
    await initializeGoogleAuth()

    const token = await new Promise((resolve) => {
      const prevCallback = tokenClient.callback

      tokenClient.callback = async (response) => {
        tokenClient.callback = prevCallback          // restore immediately

        if (response?.error) {
          // 'immediate_failed' means the user must interact — that's OK,
          // we just return null and let the UI ask them to sign in again.
          console.warn('[authService] Silent refresh failed:', response.error)
          resolve(null)
          return
        }

        try {
          const tk        = response.access_token
          const expiresIn = Number(response.expires_in || 3600)
          const user      = await fetchGoogleUserProfile(tk)
          persistSession(tk, user, expiresIn)
          resolve(tk)
        } catch (err) {
          console.warn('[authService] Post-refresh profile fetch failed:', err)
          resolve(null)
        }
      }

      // ← KEY FIX: prompt:'none' is the correct silent value per GIS docs
      tokenClient.requestAccessToken({ prompt: 'none' })
    })

    if (token) {
      notifyTokenRefresh(token)
    }

    return token
  } catch (err) {
    console.warn('[authService] refreshAccessToken error:', err)
    return null
  } finally {
    _refreshInFlight = false
  }
}

// ─── Watcher: proactive refresh loop ──────────────────────────────────────────
//
// Uses setInterval(30 s) instead of a single setTimeout(40 min).
// Rationale: browsers throttle long timers in background tabs heavily.
// A 30-second interval is cheap (it just checks a timestamp) and immune
// to that throttling — even at 10× slowdown the check still fires within
// 5 minutes, well before the token dies.

function stopTokenRefreshWatcher() {
  if (_watcherTimerId !== null) {
    clearInterval(_watcherTimerId)
    _watcherTimerId = null
  }
}

/**
 * Start the proactive refresh watcher.
 * Call this after a successful sign-in or session restore.
 * Safe to call multiple times — only one watcher runs at a time.
 */
export function startTokenRefreshWatcher() {
  stopTokenRefreshWatcher()   // cancel any previous watcher

  _watcherTimerId = setInterval(async () => {
    // Only refresh if we have a session that is near/past expiry
    if (!tokenExpiresAt) return
    if (!isTokenNearExpiry(tokenExpiresAt)) return

    console.log('[authService] Watcher: token near expiry, refreshing silently…')
    const newToken = await refreshAccessToken()
    if (newToken) {
      console.log('[authService] Watcher: silent refresh OK')
    } else {
      console.warn('[authService] Watcher: silent refresh returned null — user may need to re-login')
    }
  }, WATCHER_INTERVAL_MS)
}

// Keep the old export name as an alias so AuthContext doesn't need changing
export const scheduleTokenRefresh = startTokenRefreshWatcher

// ─── Visibility / focus / online listeners ────────────────────────────────────
//
// When the user returns to a backgrounded tab the setTimeout may have been
// heavily delayed.  These listeners guarantee a proactive refresh on every
// "return to app" event.

let _eventListenersInstalled = false

function _onFocusOrVisible() {
  if (document.visibilityState === 'hidden') return
  // Only refresh if the token is near expiry — don't spam Google
  if (!tokenExpiresAt || !isTokenNearExpiry(tokenExpiresAt)) return
  refreshAccessToken().catch(() => {})
}

function _onOnline() {
  if (!tokenExpiresAt || !isTokenNearExpiry(tokenExpiresAt)) return
  refreshAccessToken().catch(() => {})
}

export function installTokenRefreshListeners() {
  if (_eventListenersInstalled) return
  _eventListenersInstalled = true
  window.addEventListener('focus',            _onFocusOrVisible)
  document.addEventListener('visibilitychange', _onFocusOrVisible)
  window.addEventListener('online',           _onOnline)
}

export function removeTokenRefreshListeners() {
  if (!_eventListenersInstalled) return
  _eventListenersInstalled = false
  window.removeEventListener('focus',             _onFocusOrVisible)
  document.removeEventListener('visibilitychange', _onFocusOrVisible)
  window.removeEventListener('online',            _onOnline)
}

// ─── One Tap: ID token decode (client-side JWT parsing) ───────────────────────
//
// Google One Tap returns a JWT credential (ID token). For a fully client-side
// app (no backend), we decode the payload directly. The JWT is base64url-encoded
// as header.payload.signature — we only need the payload part.

function decodeIdToken(credential) {
  try {
    const parts = credential.split('.')
    if (parts.length !== 3) return null
    // base64url → base64 → decode
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(payload))
    return {
      id:      decoded.sub     || '',
      name:    decoded.name    || 'Google User',
      email:   decoded.email   || '',
      picture: decoded.picture || '',
    }
  } catch (err) {
    console.warn('[authService] Failed to decode ID token:', err)
    return null
  }
}

// ─── One Tap: initialization ──────────────────────────────────────────────────

function initializeOneTap(loginHint) {
  return new Promise((resolve) => {
    if (!window.google?.accounts?.id) {
      console.warn('[authService] google.accounts.id not available for One Tap')
      resolve(null)
      return
    }

    // Set a timeout — if One Tap doesn't fire within 8 seconds, give up
    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        console.log('[authService] One Tap timed out')
        resolve(null)
      }
    }, 8000)

    try {
      const config = {
        client_id:             getClientId(),
        callback:              (response) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          if (response?.credential) {
            const user = decodeIdToken(response.credential)
            resolve(user)
          } else {
            resolve(null)
          }
        },
        auto_select:           true,
        cancel_on_tap_outside: true,
        itp_support:           true,
        use_fedcm_for_prompt:  true,
      }

      if (loginHint) {
        config.login_hint = loginHint
      }

      window.google.accounts.id.initialize(config)
      _oneTapInitialized = true

      window.google.accounts.id.prompt((notification) => {
        if (settled) return

        // Check if prompt was suppressed or dismissed
        if (notification.isNotDisplayed()) {
          console.log('[authService] One Tap not displayed:', notification.getNotDisplayedReason())
          settled = true
          clearTimeout(timeout)
          resolve(null)
        } else if (notification.isSkippedMoment()) {
          console.log('[authService] One Tap skipped:', notification.getSkippedReason())
          settled = true
          clearTimeout(timeout)
          resolve(null)
        } else if (notification.isDismissedMoment()) {
          console.log('[authService] One Tap dismissed:', notification.getDismissedReason())
          settled = true
          clearTimeout(timeout)
          resolve(null)
        }
      })
    } catch (err) {
      console.warn('[authService] One Tap initialization error:', err)
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        resolve(null)
      }
    }
  })
}

// ─── One Tap: silent access token acquisition after ID token ──────────────────
//
// After One Tap gives us the user's identity, we still need an access_token
// for Google Drive. We use the Token Client with prompt:'none' and login_hint
// so Google knows which account to use — this often succeeds without a popup.

function silentAccessTokenRequest(loginHint) {
  return new Promise((resolve) => {
    if (!tokenClient) {
      resolve(null)
      return
    }

    const timeout = setTimeout(() => {
      resolve(null)
    }, 10000)

    const prevCallback = tokenClient.callback
    tokenClient.callback = async (response) => {
      tokenClient.callback = prevCallback
      clearTimeout(timeout)

      if (response?.error) {
        console.warn('[authService] Silent access token failed:', response.error)
        resolve(null)
        return
      }

      try {
        const tk        = response.access_token
        const expiresIn = Number(response.expires_in || 3600)
        const user      = await fetchGoogleUserProfile(tk)
        persistSession(tk, user, expiresIn)
        resolve({ accessToken: tk, user })
      } catch (err) {
        console.warn('[authService] Profile fetch after silent token failed:', err)
        resolve(null)
      }
    }

    const opts = { prompt: 'none' }
    if (loginHint) opts.login_hint = loginHint
    tokenClient.requestAccessToken(opts)
  })
}

// ─── Auto-Login Orchestrator ──────────────────────────────────────────────────
//
// This is the main entry point for automatic login. It tries multiple
// strategies in order and returns the first one that works.
//
// Flow: Silent Token Refresh → One Tap Auto-Select → null (manual login needed)

export async function attemptAutoLogin() {
  // Strategy 1: Try silent token refresh (works if token is still alive or
  // if Google's 3rd-party cookie session is active)
  const existingToken = await refreshAccessToken()
  if (existingToken) {
    console.log('[authService] Auto-login: silent token refresh succeeded')
    return { strategy: 'silent-refresh', token: existingToken }
  }

  // Get stored email for login_hint (helps Google pick the right account)
  const storedSession = getStoredSession()
  const loginHint = storedSession?.user?.email || null

  // Strategy 2: Google One Tap with auto_select
  // This works when the user has an active Google session and has previously
  // consented to this app.
  console.log('[authService] Auto-login: trying One Tap auto-select…')
  const oneTapUser = await initializeOneTap(loginHint)

  if (oneTapUser) {
    console.log('[authService] Auto-login: One Tap returned user:', oneTapUser.email)

    // We have identity — now try to silently get an access token for Drive
    const tokenResult = await silentAccessTokenRequest(oneTapUser.email)

    if (tokenResult) {
      console.log('[authService] Auto-login: silent access token after One Tap succeeded')
      return { strategy: 'one-tap+silent-token', token: tokenResult.accessToken, user: tokenResult.user }
    }

    // One Tap gave us identity but we couldn't get Drive token silently.
    // Store the user info anyway — the consent popup will be needed for Drive.
    console.warn('[authService] Auto-login: One Tap OK but Drive token needs consent')
    return { strategy: 'one-tap-identity-only', token: null, user: oneTapUser }
  }

  // All strategies failed — user needs manual login
  console.log('[authService] Auto-login: all strategies failed, manual login required')
  return null
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
        startTokenRefreshWatcher()   // start the watcher after successful login

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
  clearSession()   // also stops the watcher
  disableAutoSelect()   // prevent One Tap from auto-signing in again immediately
  try {
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token, () => {})
    }
  } catch {
    // ignore revoke errors
  }
}
