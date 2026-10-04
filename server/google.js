import { config, db, filter, HttpError, encrypt, decrypt, hash, randomToken, cookies, setCookie, safeEqual, takeLease, authenticate } from './core.js'

const SCOPES = {
 login: 'openid email profile',
 calendar: 'openid email profile https://www.googleapis.com/auth/calendar.app.created',
 drive: 'openid email profile https://www.googleapis.com/auth/drive.file',
 drive_import: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
}
async function client() {
  const { OAuth2Client } = await import('google-auth-library')
  const c = config()
  if (!c.googleId || !c.googleSecret || !c.encryptionKey) throw new HttpError(503, 'Google connection is not configured.', 'unconfigured')
  return new OAuth2Client({ clientId: c.googleId.trim(), clientSecret: c.googleSecret.trim(), redirectUri: `${c.origin}/api/oauth/callback` })
}
export async function beginOAuth(req, res, purpose = 'login') {
  if (!Object.hasOwn(SCOPES, purpose)) throw new HttpError(400, 'Unknown connection type.')
  const session = purpose === 'login' ? null : await authenticate(req, true)
  const oauth = await client()
  const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync()
  // Reuse a live binding so overlapping sign-in starts from this browser stay valid.
  const existing = cookies(req, 'lifeos_oauth').find(value => /^[A-Za-z0-9_-]{43}$/.test(value))
  const state = randomToken(), binding = existing || randomToken(), nonce = randomToken()
  const saved = await db('lifeos_oauth_states', { method: 'POST', body: {
    state_hash: hash(state), cookie_hash: hash(binding), verifier: encrypt(codeVerifier), nonce,
    purpose, owner_id: session?.owner_id || null, expires_at: new Date(Date.now() + 600_000).toISOString(),
  } })
  if (saved?.[0]?.state_hash !== hash(state) || saved[0].cookie_hash !== hash(binding)) throw new HttpError(503, 'The database did not save the sign-in request. Check the Supabase project configuration and SQL migrations.', 'oauth_state_not_saved')
  setCookie(res, 'lifeos_oauth', binding, 600)
  const connection = session ? (await db(`lifeos_connections?owner_id=eq.${session.owner_id}&select=refresh_cipher,state`))?.[0] : null
  return { url: oauth.generateAuthUrl({ scope: SCOPES[purpose], state, nonce, code_challenge: codeChallenge, code_challenge_method: 'S256',
    ...(purpose === 'login' ? {} : { access_type: 'offline', include_granted_scopes: true, ...(!connection?.refresh_cipher || connection.state === 'reconnect_required' ? { prompt: 'consent' } : {}) }),
  }) }
}
export async function finishOAuth(req, res, url) {
  const state = url.searchParams.get('state'), bindings = cookies(req, 'lifeos_oauth')
  if (!state) throw oauthStateError('missing_state', 'The sign-in request expired. Start again.')
  // Validate the browser before consuming the state. A mismatched request must
  // not invalidate the original browser's attempt.
  const states = await db(`lifeos_oauth_states?state_hash=eq.${hash(state)}&select=*`)
  const pending = Array.isArray(states) ? states[0] : null
  if (!pending) {
    // Browsers occasionally replay the callback. If the first one already signed the user in, continue.
    if (await hasSession(req)) return redirect(res, '/')
    throw oauthStateError('state_not_found', 'This sign-in link was already used or has expired. Click "Sign in with Google" again.')
  }
  if (!(new Date(pending.expires_at).getTime() > Date.now())) throw oauthStateError('state_expired', 'The sign-in request expired. Start again.')
  if (!bindings.length) throw oauthStateError('missing_cookie', 'Your browser did not keep the sign-in cookie. Allow cookies for this site and start sign-in again in the same browser.')
  if (!bindings.some(binding => safeEqual(hash(binding), pending.cookie_hash))) throw oauthStateError('cookie_mismatch', 'This sign-in was replaced by a newer attempt or started in a different browser. Use one tab and try again.')
  // Conditional DELETE RETURNING claims the verified state exactly once, even
  // when callbacks reach different function instances concurrently.
  const claimed = await db(`lifeos_oauth_states?state_hash=eq.${hash(state)}&cookie_hash=eq.${filter(pending.cookie_hash)}&expires_at=gt.${filter(new Date().toISOString())}`, { method: 'DELETE' })
  if (!claimed?.length) throw oauthStateError('state_consumed', 'This sign-in request is already being completed. Return to LifeOS and try again if needed.')
  // Let the ten-minute binding expire naturally: another tab may still need it.
  if (url.searchParams.has('error')) throw new HttpError(400, 'Google access was declined. Your local data is unchanged.', 'oauth_denied')
  const code = url.searchParams.get('code')
  if (!code) throw new HttpError(400, 'Missing authorization code.')
  const oauth = await client()
  let codeVerifier
  try { codeVerifier = decrypt(pending.verifier) }
  catch {
    console.warn('[lifeos] OAuth callback rejected: encryption_key_mismatch')
    throw new HttpError(503, 'The server encryption key changed during sign-in. Keep TOKEN_ENCRYPTION_KEY unchanged across deployments and start a new sign-in.', 'oauth_encryption')
  }
  let tokens
  try { ({ tokens } = await oauth.getToken({ code, codeVerifier })) }
  catch (error) { throw tokenExchangeError(error) }
  if (!tokens.id_token) throw new HttpError(401, 'Google did not provide a verified identity.')
  const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: config().googleId })
  const identity = ticket.getPayload()
  if (!identity?.sub || !identity.email_verified || !safeEqual(identity.nonce, pending.nonce)) throw new HttpError(401, 'Google identity verification failed.')
  let user
  if (pending.owner_id) {
    const session = await authenticate(req)
    if (session.owner_id !== pending.owner_id) throw new HttpError(403, 'Your LifeOS account changed during connection.')
    user = (await db(`lifeos_users?id=eq.${pending.owner_id}&select=*`))?.[0]
    if (user?.google_sub !== identity.sub) throw new HttpError(409, 'Choose the Google account belonging to this LifeOS account.', 'account_mismatch')
  } else {
    const users = await db('lifeos_users?on_conflict=google_sub', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { google_sub: identity.sub, name: identity.name || '', email: identity.email || '', picture: identity.picture || null } })
    user = users[0]
    const sessionToken = randomToken()
    await db('lifeos_sessions', { method: 'POST', body: { token_hash: hash(sessionToken), owner_id: user.id, csrf: randomToken(), expires_at: new Date(Date.now() + 30 * 86400_000).toISOString() } })
    setCookie(res, 'lifeos_session', sessionToken, 30 * 86400)
  }
  if (pending.purpose !== 'login') {
    const previous = (await db(`lifeos_connections?owner_id=eq.${user.id}&select=*`))?.[0]
    const refreshCipher = mergedRefreshToken(previous?.refresh_cipher, tokens.refresh_token ? encrypt(tokens.refresh_token) : null)
    if (!refreshCipher) throw new HttpError(409, 'Google did not grant offline access. Reconnect to authorize background refresh.', 'offline_access_missing')
    await db('lifeos_connections?on_conflict=owner_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: {
      owner_id: user.id, google_sub: identity.sub, refresh_cipher: refreshCipher,
      access_cipher: encrypt(tokens.access_token), expires_at: new Date(tokens.expiry_date || Date.now() + 3600_000).toISOString(),
      scopes: tokens.scope || previous?.scopes || '', state: 'connected', calendar_id: previous?.calendar_id || null,
    } })
  }
  redirect(res, pending.purpose === 'drive_import' ? '/me?connected=drive_import#drive-import' : `/?connected=${pending.purpose}`)
}
function redirect(res, path) {
  res.statusCode = 303; res.setHeader('Location', `${config().origin}${path}`); res.setHeader('Cache-Control', 'no-store'); res.end()
}
async function hasSession(req) {
  try { await authenticate(req); return true } catch { return false }
}
// Logged without secrets so deployment logs show which check failed.
function oauthStateError(reason, message) {
  console.warn(`[lifeos] OAuth callback rejected: ${reason}`)
  return new HttpError(400, message, 'oauth_state')
}
function tokenExchangeError(error) {
  const failures = {
    invalid_client: [503, 'Google rejected the app credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from the same Google OAuth Web client in Vercel, then redeploy.'],
    invalid_grant: [400, 'Google rejected the sign-in code (invalid_grant). Start a fresh sign-in from LifeOS; do not reload the callback or reuse an old sign-in link.'],
    redirect_uri_mismatch: [503, 'Google rejected the callback URL. Add APP_ORIGIN followed by /api/oauth/callback to the same OAuth client’s authorized redirect URIs.'],
    unauthorized_client: [503, 'This Google OAuth client cannot use server sign-in. Configure a Web application OAuth client and its matching secret.'],
    invalid_request: [400, 'Google rejected the token request (invalid_request). Check the OAuth Web client configuration and start a fresh sign-in.'],
  }
  const providerCode = error?.response?.data?.error
  const known = typeof providerCode === 'string' && Object.hasOwn(failures, providerCode)
  // Never log or return the provider error object: its request can contain
  // the client secret, authorization code and PKCE verifier.
  const reason = known ? providerCode : 'provider_unavailable'
  console.warn(`[lifeos] OAuth token exchange rejected: ${reason}`)
  const [status, message] = known ? failures[reason] : [503, 'The server could not exchange the sign-in code with Google. Start a new sign-in shortly; check Vercel function connectivity if this continues.']
  return new HttpError(status, message, `oauth_${reason}`)
}
export function mergedRefreshToken(previous, incoming) { return incoming || previous || null }
export function createTokenManager({ storage = db, oauthClient = client, lease = takeLease, now = Date.now } = {}) {
 const refreshing = new Map()
 return async function managedAccessToken(owner, force = false) {
  if (refreshing.has(owner)) return refreshing.get(owner)
  const work = (async () => {
    const read = async () => (await storage(`lifeos_connections?owner_id=eq.${owner}&select=*`))?.[0]
    let connection = await read()
    if (!connection?.refresh_cipher || connection.state === 'reconnect_required') throw new HttpError(409, 'Reconnect Google to restore this integration.', 'reconnect_required')
    if (!force && new Date(connection.expires_at).getTime() > now() + 90_000) return decrypt(connection.access_cipher)
    const release = await lease(`refresh:${owner}`, 60)
    try {
      connection = await read()
      if (!force && new Date(connection.expires_at).getTime() > now() + 90_000) return decrypt(connection.access_cipher)
      const oauth = await oauthClient(); oauth.setCredentials({ refresh_token: decrypt(connection.refresh_cipher) })
      let credentials
      try { ({ credentials } = await oauth.refreshAccessToken()) }
      catch (error) {
        if (error.response?.data?.error === 'invalid_grant') {
          await storage(`lifeos_connections?owner_id=eq.${owner}`, { method: 'PATCH', body: { state: 'reconnect_required', access_cipher: null } })
          throw new HttpError(409, 'Google authorization was revoked or expired. Reconnect when ready.', 'reconnect_required')
        }
        throw new HttpError(503, 'Google is temporarily unavailable. Retry later.', 'provider_unavailable')
      }
      await storage(`lifeos_connections?owner_id=eq.${owner}`, { method: 'PATCH', body: { access_cipher: encrypt(credentials.access_token), refresh_cipher: credentials.refresh_token ? encrypt(credentials.refresh_token) : connection.refresh_cipher, expires_at: new Date(credentials.expiry_date).toISOString(), state: 'connected' } })
      return credentials.access_token
    } finally { await release() }
  })().finally(() => refreshing.delete(owner))
  refreshing.set(owner, work)
  return work
 }
}
export const accessToken = createTokenManager()
export async function googleFetch(owner, path, options = {}) {
  let token = await accessToken(owner)
  let result = await fetch(`https://www.googleapis.com${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
  if (result.status === 401) {
    token = await accessToken(owner, true)
    result = await fetch(`https://www.googleapis.com${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
  }
  if (result.status === 403 || result.status === 429) throw new HttpError(result.status, 'Google denied the operation. Check granted scopes, calendar permissions or quota; your app session remains active.', 'provider_permission_or_quota')
  return result
}
export async function disconnect(owner) {
  const connection = (await db(`lifeos_connections?owner_id=eq.${owner}&select=*`))?.[0]
  if (connection?.refresh_cipher) {
    const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: decrypt(connection.refresh_cipher) }), signal: AbortSignal.timeout(15_000) })
    if (!response.ok && response.status !== 400) throw new HttpError(503, 'Google revocation failed. Please retry.')
  }
  await db(`lifeos_connections?owner_id=eq.${owner}`, { method: 'DELETE' })
}
