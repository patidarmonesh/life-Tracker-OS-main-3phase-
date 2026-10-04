import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/handler.js'

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = body } }
}

test('Vercel rewrite reaches nested OAuth route instead of a platform 404', async () => {
  const req = { url: '/api/handler?lifeosRoute=oauth/start', method: 'POST', headers: {} }
  const res = response()
  await handler(req, res)
  assert.equal(req.url, '/api/oauth/start')
  assert.equal(res.statusCode, 403)
  assert.equal(JSON.parse(res.body).error, 'Request verification failed.')
})

test('OAuth callback rewrite preserves Google query parameters', async () => {
  const req = { url: '/api/handler?lifeosRoute=oauth/callback&code=test-code&state=test-state', method: 'GET', headers: {} }
  const res = response()
  await handler(req, res)
  assert.equal(req.url, '/api/oauth/callback?code=test-code&state=test-state')
  assert.equal(res.statusCode, 303)
  assert.ok(res.headers.Location.includes('error='))
})
