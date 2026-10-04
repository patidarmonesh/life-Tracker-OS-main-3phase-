import test from 'node:test'
import assert from 'node:assert/strict'
import { refreshAccessToken, getAccessToken, getStoredSession, signOutGoogle } from '../src/services/authService.js'

const store = new Map([['lifeos_google_session', JSON.stringify({ accessToken: 'expired', tokenExpiresAt: 1, user: { id: 'test' }, persistent: true })]])
globalThis.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }
globalThis.window = {}

test('expired tokens refresh once for concurrent callers, without any popup', async t => {
  let tokenCalls = 0
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('config')) return Response.json({ configured: true })
    tokenCalls++
    return Response.json({ accessToken: 'fresh', expiresIn: 3600, user: { id: 'test' } })
  })
  assert.equal(getAccessToken(), null)
  assert.deepEqual(await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]), ['fresh', 'fresh', 'fresh'])
  assert.equal(tokenCalls, 1)
  assert.equal(getStoredSession().persistent, true)
  assert.equal(await refreshAccessToken(), 'fresh')
  assert.equal(tokenCalls, 1)
})
test('revocation never restores an invalid access token from storage', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'expired' }, { status: 401 }))
  assert.equal(await refreshAccessToken(true), null)
  assert.equal(getAccessToken(), null)
  assert.equal(getStoredSession().user.id, 'test')
})
test('logout prevents a late refresh response from restoring the session', async t => {
  let finish
  const started = new Promise(resolve => {
    t.mock.method(globalThis, 'fetch', async url => {
      if (url.includes('logout')) return Response.json({ ok: true })
      resolve()
      return new Promise(done => { finish = () => done(Response.json({ accessToken: 'late', expiresIn: 3600, user: { id: 'test' } })) })
    })
  })
  const refresh = refreshAccessToken(true)
  await started
  await signOutGoogle()
  finish()
  assert.equal(await refresh, null)
  assert.equal(getAccessToken(), null)
  assert.equal(getStoredSession(), null)
})
