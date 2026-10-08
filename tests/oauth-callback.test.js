import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hash, randomToken, encrypt } from '../server/core.js'
import { OAuth2Client } from 'google-auth-library'
import route from '../server/routes.js'

Object.assign(process.env, {
  APP_ORIGIN: 'https://lifeos.test', SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service',
  GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'secret', TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
})

// Minimal PostgREST stand-in for the tables touched by the OAuth flow.
function installDb({ states = [], sessions = [], users = [] } = {}) {
  const calls = []
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)), method = init.method || 'GET'
    calls.push({ method, path: url.pathname, search: url.search })
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.hostname !== 'db.test') return json(400, { error: 'invalid_grant' })
    const eq = key => url.searchParams.get(key)?.replace(/^eq\./, '')
    if (url.pathname.endsWith('/lifeos_oauth_states') && method === 'POST') { const row = JSON.parse(init.body); states.push(row); return json(201, [row]) }
    if (url.pathname.endsWith('/lifeos_oauth_states') && method === 'GET') return json(200, states.filter(row => row.state_hash === eq('state_hash')))
    if (url.pathname.endsWith('/lifeos_oauth_states') && method === 'DELETE') {
      const index = states.findIndex(row => row.state_hash === eq('state_hash') && row.cookie_hash === eq('cookie_hash') && Date.parse(row.expires_at) > Date.parse(url.searchParams.get('expires_at').slice(3)))
      return json(200, index < 0 ? [] : states.splice(index, 1))
    }
    if (url.pathname.endsWith('/lifeos_users') && method === 'POST') { const row = { id: 'u1', ...JSON.parse(init.body) }; users.push(row); return json(201, [row]) }
    if (url.pathname.endsWith('/lifeos_users')) return json(200, users.filter(row => row.id === eq('id')))
    if (url.pathname.endsWith('/lifeos_sessions') && method === 'POST') { const row = JSON.parse(init.body); sessions.push(row); return json(201, [row]) }
    if (url.pathname.endsWith('/lifeos_sessions')) return json(200, sessions.filter(row => row.token_hash === eq('token_hash')))
    return json(200, [])
  }
  return { states, sessions, calls }
}
function response() {
  return { statusCode: 200, headers: {}, getHeader(key) { return this.headers[key] }, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = body } }
}
async function callback(state, cookieHeader) {
  const res = response()
  await route({ url: `/api/oauth/callback?state=${state}&code=abc`, method: 'GET', headers: { cookie: cookieHeader } }, res)
  return { res, location: decodeURIComponent(res.headers.Location || '') }
}
const pendingRow = (state, binding, expires = Date.now() + 60_000) => ({ state_hash: hash(state), cookie_hash: hash(binding), verifier: 'x', nonce: 'n', purpose: 'login', owner_id: null, expires_at: new Date(expires).toISOString() })

test('duplicate lifeos_oauth cookies still match the stored binding', async () => {
  const state = randomToken(), binding = randomToken()
  installDb({ states: [pendingRow(state, binding)] })
  const { location } = await callback(state, `lifeos_oauth=${randomToken()}; lifeos_oauth=${binding}`)
  // Passing the state check means the flow reaches Google's code exchange.
  assert.match(location, /server encryption key changed/)
})

test('unknown state reports a clear retry message', async () => {
  installDb()
  const { res, location } = await callback(randomToken(), `lifeos_oauth=${randomToken()}`)
  assert.equal(res.statusCode, 303)
  assert.match(location, /already used or has expired/)
})

test('replayed callback after a successful sign-in continues into the app', async () => {
  const token = randomToken()
  installDb({ sessions: [{ token_hash: hash(token), owner_id: 'u1', csrf: 'c', expires_at: new Date(Date.now() + 1e6).toISOString() }] })
  const { res } = await callback(randomToken(), `lifeos_session=${token}`)
  assert.equal(res.statusCode, 303)
  assert.equal(res.headers.Location, 'https://lifeos.test/')
})

test('binding mismatch and missing cookie are reported separately', async () => {
  const state = randomToken(), binding = randomToken()
  const db = installDb({ states: [pendingRow(state, binding)] })
  assert.match((await callback(state, `lifeos_oauth=${randomToken()}`)).location, /replaced by a newer attempt/)
  assert.equal(db.states.length, 1, 'Wrong browser must not consume the original sign-in request')
  const second = randomToken()
  installDb({ states: [pendingRow(second, binding)] })
  assert.match((await callback(second, '')).location, /did not keep the sign-in cookie/)
})

test('full sign-in saves state, exchanges with PKCE, verifies nonce and restores app session', async t => {
  const db = installDb()
  const start = response()
  await route({ url: '/api/oauth/start', method: 'POST', headers: { origin: 'https://lifeos.test', 'content-type': 'application/json' }, body: { purpose: 'login' } }, start)
  assert.equal(start.statusCode, 200)
  const authUrl = new URL(JSON.parse(start.body).url)
  const bindingCookie = start.headers['Set-Cookie'][0].split(';')[0]
  t.mock.method(OAuth2Client.prototype, 'getToken', async ({ code, codeVerifier }) => {
    assert.equal(code, 'abc')
    assert.ok(codeVerifier.length >= 43)
    return { tokens: { id_token: 'verified-token' } }
  })
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async ({ idToken, audience }) => {
    assert.equal(idToken, 'verified-token'); assert.equal(audience, process.env.GOOGLE_CLIENT_ID)
    return { getPayload: () => ({ sub: 'google-user', email_verified: true, nonce: db.states[0]?.nonce || authUrl.searchParams.get('nonce'), email: 'test@example.test' }) }
  })
  const { res } = await callback(authUrl.searchParams.get('state'), bindingCookie)
  assert.equal(res.headers.Location, 'https://lifeos.test/?connected=login')
  assert.equal(db.states.length, 0)
  assert.equal(db.sessions.length, 1)
  const sessionCookie = res.headers['Set-Cookie'].find(value => value.startsWith('lifeos_session=')).split(';')[0]
  const restored = response()
  await route({ url: '/api/session', method: 'GET', headers: { cookie: sessionCookie } }, restored)
  assert.equal(JSON.parse(restored.body).user.id, 'u1')
  assert.equal((await callback(authUrl.searchParams.get('state'), sessionCookie)).res.headers.Location, 'https://lifeos.test/')
})

test('concurrent callbacks exchange a state only once', async t => {
  const state = randomToken(), binding = randomToken()
  installDb({ states: [{ ...pendingRow(state, binding), verifier: encrypt('test-verifier') }] })
  let exchanges = 0
  t.mock.method(OAuth2Client.prototype, 'getToken', async () => { exchanges++; return { tokens: { id_token: 'token' } } })
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({ sub: 'google-user', email_verified: true, nonce: 'n' }) }))
  const results = await Promise.all([callback(state, `lifeos_oauth=${binding}`), callback(state, `lifeos_oauth=${binding}`)])
  assert.equal(exchanges, 1)
  assert.equal(results.filter(result => result.res.headers.Location === 'https://lifeos.test/?connected=login').length, 1)
})

test('sign-in stops before Google when storage returns HTML or an empty write result', async () => {
  for (const body of ['<html>Dashboard</html>', '[]']) {
    globalThis.fetch = async () => new Response(body, { status: 200 })
    const res = response()
    await route({ url: '/api/oauth/start', method: 'POST', headers: { origin: 'https://lifeos.test', 'content-type': 'application/json' }, body: { purpose: 'login' } }, res)
    assert.equal(res.statusCode, 503)
    assert.equal(JSON.parse(res.body).url, undefined)
    assert.match(JSON.parse(res.body).code, /storage_invalid_response|oauth_state_not_saved/)
    assert.equal(res.headers['Set-Cookie'], undefined)
  }
})

test('a Supabase dashboard URL is rejected before credentials are sent', async () => {
  const original = process.env.SUPABASE_URL
  process.env.SUPABASE_URL = 'https://supabase.com/dashboard/project/example'
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Must not send credentials to the dashboard') }
  try {
    const res = response()
    await route({ url: '/api/oauth/start', method: 'POST', headers: { origin: 'https://lifeos.test', 'content-type': 'application/json' }, body: { purpose: 'login' } }, res)
    assert.equal(res.statusCode, 503)
    assert.equal(JSON.parse(res.body).code, 'storage_url_invalid')
    assert.equal(calls, 0)
  } finally { process.env.SUPABASE_URL = original }
})

for (const [providerCode, expected] of [
  ['invalid_client', /Google rejected the app credentials/],
  ['invalid_grant', /Google rejected the sign-in code/],
  ['redirect_uri_mismatch', /Google rejected the callback URL/],
  ['unexpected-private-provider-message', /server could not exchange/],
]) {
  test(`token exchange reports ${providerCode} without leaking credentials`, async t => {
    const state = randomToken(), binding = randomToken()
    installDb({ states: [{ ...pendingRow(state, binding), verifier: encrypt('test-verifier') }] })
    const warnings = []
    t.mock.method(console, 'warn', message => warnings.push(message))
    t.mock.method(OAuth2Client.prototype, 'getToken', async () => {
      throw Object.assign(new Error('private-client-secret'), { response: { data: { error: providerCode, error_description: 'private-client-secret' } }, config: { body: 'private-client-secret' } })
    })
    const { location } = await callback(state, `lifeos_oauth=${binding}`)
    assert.match(location, expected)
    assert.doesNotMatch(JSON.stringify({ location, warnings }), /private-client-secret|unexpected-private-provider-message/)
  })
}

test('expired state is rejected', async () => {
  const state = randomToken(), binding = randomToken()
  installDb({ states: [pendingRow(state, binding, Date.now() - 1000)] })
  assert.match((await callback(state, `lifeos_oauth=${binding}`)).location, /expired/)
})

test('a second sign-in start reuses the browser binding', async () => {
  const db = installDb()
  const start = async cookieHeader => {
    const res = response()
    await route({ url: '/api/oauth/start', method: 'POST', headers: { origin: 'https://lifeos.test', 'content-type': 'application/json', cookie: cookieHeader }, body: { purpose: 'login' } }, res)
    assert.equal(res.statusCode, 200, res.body)
    return res.headers['Set-Cookie'][0].match(/^lifeos_oauth=([^;]+)/)[1]
  }
  const first = await start('')
  const second = await start(`lifeos_oauth=${first}`)
  assert.equal(second, first)
  assert.equal(db.states.length, 2)
  assert.ok(db.states.every(row => row.cookie_hash === hash(first)))
})
