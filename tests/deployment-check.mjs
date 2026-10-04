// Verifies deployed routing, database state persistence and browser binding.
// Creates and consumes only its own temporary OAuth state; never signs a user in.
const origin = new URL(process.argv[2] || 'https://alltracker.vercel.app').origin
try {
  const start = await fetch(`${origin}/api/oauth/start`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose: 'login' }), signal: AbortSignal.timeout(30_000),
  })
  const data = await start.json().catch(() => null)
  if (!start.ok || !data?.url) throw new Error(data?.error || `OAuth start failed (HTTP ${start.status}). Check API routing and function logs.`)
  const authorization = new URL(data.url)
  const binding = start.headers.getSetCookie().find(value => value.startsWith('lifeos_oauth='))?.split(';')[0]
  if (!binding) throw new Error('OAuth start did not set the browser binding cookie.')
  const callback = new URL('/api/oauth/callback', origin)
  callback.searchParams.set('state', authorization.searchParams.get('state'))
  callback.searchParams.set('error', 'access_denied')
  const result = await fetch(callback, { headers: { Cookie: binding }, redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const location = new URL(result.headers.get('location') || '/', origin)
  const error = location.searchParams.get('error')
  if (result.status !== 303 || error !== 'Google access was declined. Your local data is unchanged.') throw new Error(error || `OAuth callback failed (HTTP ${result.status}).`)
  console.log('PASS: deployed OAuth routing, saved state and cookie validation. Real Google account login and Calendar consent still require browser verification.')
} catch (error) {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
}
