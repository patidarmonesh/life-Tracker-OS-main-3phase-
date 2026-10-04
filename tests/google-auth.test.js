import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/google-auth.js'
import { seal, unseal } from '../server/googleSession.js'

process.env.GOOGLE_CLIENT_ID = 'test-client'
process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
process.env.SESSION_SECRET = 'test-only-session-secret-at-least-32-characters'
process.env.APP_URL = 'https://lifeos.example'
const response = () => ({ code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(body) { this.body = body; return this }, send(body) { this.body = body; return this }, redirect(code, url) { this.code = code; this.url = url; return this } })
test('encrypted session rejects tampering and expiry', () => {
  const value = seal({ refreshToken: 'never-plaintext', expires: Date.now() + 10000 })
  assert.ok(!value.includes('never-plaintext'))
  assert.equal(unseal(value).refreshToken, 'never-plaintext')
  assert.equal(unseal('x' + value.slice(1)), null)
  assert.equal(unseal(seal({ expires: Date.now() - 1 })), null)
})
test('OAuth start requests offline access, PKCE and scoped secure HttpOnly state', async () => {
  const res = response()
  await handler({ method: 'GET', query: { action: 'start' }, headers: {} }, res)
  const url = new URL(res.url)
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.match(url.searchParams.get('scope'), /calendar.events/)
  assert.match(res.headers['Set-Cookie'], /HttpOnly; SameSite=Lax/)
  assert.match(res.headers['Set-Cookie'], /Secure/)
})
test('token rejects cross-origin, missing session and callback state mismatch', async () => {
  let res = response()
  await handler({ method: 'POST', query: { action: 'token' }, headers: { origin: 'https://other.example' } }, res)
  assert.equal(res.code, 403)
  res = response()
  await handler({ method: 'POST', query: { action: 'token' }, headers: { origin: process.env.APP_URL } }, res)
  assert.equal(res.code, 401)
  res = response()
  await handler({ method: 'GET', query: { action: 'callback', state: 'wrong' }, headers: {} }, res)
  assert.equal(res.code, 400)
})
test('refresh returns access token only and renews encrypted cookie', async t => {
  const session = seal({ refreshToken: 'private-refresh', user: { id: '1' }, expires: Date.now() + 10000 })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token')
    assert.equal(options.body.get('grant_type'), 'refresh_token')
    return Response.json({ access_token: 'fresh-access', expires_in: 3600 })
  })
  const res = response()
  await handler({ method: 'POST', query: { action: 'token' }, headers: { origin: process.env.APP_URL, cookie: `lifeos_refresh=${session}` } }, res)
  assert.equal(res.body.accessToken, 'fresh-access')
  assert.ok(!JSON.stringify(res.body).includes('private-refresh'))
  assert.equal(res.headers['Cache-Control'], 'no-store')
})
test('revoked refresh token clears the session and requires reconnect', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'invalid_grant' }, { status: 400 }))
  const res = response()
  await handler({ method: 'POST', query: { action: 'token' }, headers: { origin: process.env.APP_URL, cookie: `lifeos_refresh=${seal({ refreshToken: 'revoked', expires: Date.now() + 10000 })}` } }, res)
  assert.equal(res.code, 401)
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/)
})
