// Server authorization-code flow refreshes silently; GIS remains a static-host fallback.
const SESSION_KEY = 'lifeos_google_session'
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events'
let accessToken = null, tokenExpiresAt = 0, serverEnabled = false, configPromise, refreshPromise, scriptPromise
let generation = 0
const callbacks = new Set()
export function onTokenRefresh(callback) { callbacks.add(callback); return () => callbacks.delete(callback) }
const clientId = () => localStorage.getItem('lifeos_google_client_id')?.trim() || import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
export function hasClientId() { return serverEnabled || Boolean(clientId()) }
export function hasPersistentGoogleAuth() { return serverEnabled }

async function serverAvailable() {
  if (!configPromise) configPromise = fetch('/api/google-auth?action=config', { signal: AbortSignal.timeout(5000) })
    .then(r => r.ok ? r.json() : {}).then(data => { serverEnabled = data.configured === true; return serverEnabled }).catch(() => false)
  return configPromise
}
export function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}
function persist(token, user, expiresIn, persistent = false) {
  accessToken = token
  tokenExpiresAt = Date.now() + Number(expiresIn || 3600) * 1000
  localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: token, tokenExpiresAt, user, persistent }))
  localStorage.removeItem('lifeos_logged_out')
  callbacks.forEach(cb => { try { cb({ token, user }) } catch { /* isolate listeners */ } })
  return { accessToken: token, user }
}
export function getAccessToken() {
  if (localStorage.getItem('lifeos_logged_out') === 'true') return null
  if (!accessToken) {
    const session = getStoredSession()
    accessToken = session?.accessToken || null
    tokenExpiresAt = Number(session?.tokenExpiresAt || 0)
  }
  return accessToken && tokenExpiresAt > Date.now() + 60000 ? accessToken : null
}
export async function refreshAccessToken(force = false) {
  if (localStorage.getItem('lifeos_logged_out') === 'true') return null
  if (!force && getAccessToken()) return getAccessToken()
  if (!await serverAvailable()) return null
  if (!refreshPromise) {
    const requestGeneration = generation
    refreshPromise = (async () => {
      const res = await fetch('/api/google-auth?action=token', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(20000) })
      if (res.status === 401) {
        accessToken = null; tokenExpiresAt = 0
        const previous = getStoredSession()
        if (previous) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...previous, accessToken: null, tokenExpiresAt: 0 }))
        return null
      }
      if (!res.ok) throw new Error('Google refresh temporarily unavailable. Sync will retry.')
      const data = await res.json()
      if (requestGeneration !== generation) return null
      persist(data.accessToken, data.user, data.expiresIn, true)
      return data.accessToken
    })().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}
export async function initializeGoogleAuth() { return await serverAvailable() || hasClientId() }
export async function attemptAutoLogin() {
  const params = new URLSearchParams(window.location.search)
  const connected = params.get('google_auth') === 'connected'
  if (connected) {
    localStorage.removeItem('lifeos_logged_out')
    accessToken = null; tokenExpiresAt = 0
    params.delete('google_auth')
    window.history.replaceState({}, '', window.location.pathname + (params.size ? '?' + params : ''))
  }
  if (localStorage.getItem('lifeos_logged_out') === 'true') return null
  let token = null
  try { token = await refreshAccessToken(connected) } catch { /* retain local session offline */ }
  const session = getStoredSession()
  return session?.user ? { token, user: session.user } : null
}
export function installTokenRefreshListeners() {
  const refresh = () => {
    if (document.visibilityState === 'visible' && getStoredSession()?.persistent) refreshAccessToken().catch(() => {})
  }
  const timer = setInterval(refresh, 30000)
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('online', refresh)
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh) }
}
export function startTokenRefreshWatcher() { /* lifecycle owned by installTokenRefreshListeners */ }
export const scheduleTokenRefresh = startTokenRefreshWatcher
export function removeTokenRefreshListeners() { /* cleanup returned by install */ }
export function disableAutoSelect() { window.google?.accounts?.id?.disableAutoSelect?.() }
function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const timer = setTimeout(() => reject(new Error('Google sign-in timed out. Retry.')), 10000)
    script.onload = () => { clearTimeout(timer); resolve() }
    script.onerror = () => { clearTimeout(timer); reject(new Error('Unable to load Google sign-in')) }
    document.head.appendChild(script)
  }).catch(error => { scriptPromise = null; throw error })
  return scriptPromise
}
export async function signInWithGoogle() {
  if (await serverAvailable()) {
    window.location.assign('/api/google-auth?action=start')
    return null
  }
  if (!clientId()) throw new Error('Set your Google Client ID in Settings.')
  await loadScript()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(), scope: SCOPES,
      error_callback: () => reject(new Error('Google sign-in was closed or blocked. Please retry.')),
      callback: async response => {
        if (response.error) return reject(new Error(response.error))
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + response.access_token } })
          if (!res.ok) throw new Error('Unable to fetch Google profile')
          const p = await res.json()
          resolve(persist(response.access_token, { id: p.sub, name: p.name, email: p.email, picture: p.picture }, response.expires_in))
        } catch (error) { reject(error) }
      },
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}
export const reconnectGoogle = signInWithGoogle
export async function signOutGoogle() {
  generation++
  accessToken = null; tokenExpiresAt = 0
  localStorage.setItem('lifeos_logged_out', 'true')
  localStorage.removeItem(SESSION_KEY)
  disableAutoSelect()
  if (serverEnabled) await fetch('/api/google-auth?action=logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
}

