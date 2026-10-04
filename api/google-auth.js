import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { configured, origin, SCOPES, seal, unseal, readCookie, cookie, exchange } from '../server/googleSession.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const action = req.query?.action || new URL(req.url, 'http://localhost').searchParams.get('action')
  if (action === 'config') return res.status(200).json({ configured: configured() })
  if (!configured()) return res.status(503).json({ error: 'Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET and APP_URL on Vercel.' })
  const callback = `${origin()}/api/google-auth?action=callback`
  if (['token', 'logout'].includes(action)) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    if (req.headers.origin !== origin()) return res.status(403).json({ error: 'Origin not allowed' })
  } else if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' })
  try {
    if (action === 'start') {
      const state = randomBytes(32).toString('base64url')
      const verifier = randomBytes(48).toString('base64url')
      res.setHeader('Set-Cookie', cookie('lifeos_oauth', seal({ state, verifier, expires: Date.now() + 600000 }), 600))
      const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: callback, response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
      return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
    }
    if (action === 'callback') {
      const pending = unseal(readCookie(req, 'lifeos_oauth'))
      const supplied = Buffer.from(String(req.query.state || ''))
      const expected = Buffer.from(pending?.state || '')
      if (!pending || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(400).send('Invalid or expired login request. Return to LifeOS and reconnect.')
      res.setHeader('Set-Cookie', cookie('lifeos_oauth', '', 0))
      if (req.query.error) return res.redirect(302, `${origin()}/?google_auth=cancelled`)
      const tokens = await exchange({ code: req.query.code, grant_type: 'authorization_code', redirect_uri: callback, code_verifier: pending.verifier })
      if (!tokens.refresh_token) throw new Error('Google did not return offline access. Reconnect and allow the requested permissions.')
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15000) })
      if (!profileRes.ok) throw new Error('Unable to load Google account.')
      const profile = await profileRes.json()
      const session = { refreshToken: tokens.refresh_token, user: { id: profile.sub, name: profile.name, email: profile.email, picture: profile.picture }, expires: Date.now() + 180 * 86400000 }
      res.setHeader('Set-Cookie', [cookie('lifeos_oauth', '', 0), cookie('lifeos_refresh', seal(session), 180 * 86400)])
      return res.redirect(302, `${origin()}/?google_auth=connected`)
    }
    if (action === 'logout') {
      const session = unseal(readCookie(req, 'lifeos_refresh'))
      res.setHeader('Set-Cookie', cookie('lifeos_refresh', '', 0))
      if (session) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: session.refreshToken }), signal: AbortSignal.timeout(10000) }).catch(() => {})
      return res.status(200).json({ ok: true })
    }
    if (action === 'token') {
      const session = unseal(readCookie(req, 'lifeos_refresh'))
      if (!session) return res.status(401).json({ error: 'Connect Google to enable automatic refresh.' })
      const tokens = await exchange({ refresh_token: session.refreshToken, grant_type: 'refresh_token' })
      session.refreshToken = tokens.refresh_token || session.refreshToken
      session.expires = Date.now() + 180 * 86400000
      res.setHeader('Set-Cookie', cookie('lifeos_refresh', seal(session), 180 * 86400))
      return res.status(200).json({ accessToken: tokens.access_token, expiresIn: tokens.expires_in, user: session.user, scope: tokens.scope })
    }
    return res.status(404).json({ error: 'Unknown action' })
  } catch (error) {
    if (error.status === 401) res.setHeader('Set-Cookie', cookie('lifeos_refresh', '', 0))
    return res.status(error.status || 502).json({ error: error.message || 'Google connection failed' })
  }
}
