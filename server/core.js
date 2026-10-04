import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export class HttpError extends Error {
  constructor(status, message, code = 'request_failed') { super(message); this.status = status; this.code = code }
}
export const hash = value => createHash('sha256').update(String(value)).digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')
export const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
export const config = () => ({
  origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  database: process.env.SUPABASE_URL,
  databaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  googleId: process.env.GOOGLE_CLIENT_ID,
  googleSecret: process.env.GOOGLE_CLIENT_SECRET,
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
  aiKey: process.env.GEMINI_API_KEY,
  aiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  vapidPublic: process.env.VAPID_PUBLIC_KEY,
  vapidPrivate: process.env.VAPID_PRIVATE_KEY,
})
export function capabilities() {
  const c = config()
  const storage = !!(c.database && c.databaseKey)
  const auth = storage && !!(c.googleId && c.googleSecret && c.encryptionKey)
  return { auth, sync: storage, google: auth, ai: auth && !!c.aiKey, shares: auth, push: auth && !!(c.vapidPublic && c.vapidPrivate && process.env.VAPID_SUBJECT), vapidPublicKey: c.vapidPublic || null }
}
export function encrypt(value, key = config().encryptionKey) {
  const secret = Buffer.from(key || '', 'base64')
  if (secret.length !== 32) throw new HttpError(503, 'Server token encryption is not configured.', 'unconfigured')
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secret, nonce)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return [nonce, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.')
}
export function decrypt(value, key = config().encryptionKey) {
  const [nonce, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
export async function db(path, { method = 'GET', body, headers = {} } = {}) {
  const c = config()
  if (!c.database || !c.databaseKey) throw new HttpError(503, 'Cloud storage is not configured. Your local records remain available.', 'unconfigured')
  let databaseUrl
  try { databaseUrl = new URL(c.database.trim()) } catch { /* handled below */ }
  if (!databaseUrl || databaseUrl.hostname === 'supabase.com' || databaseUrl.hostname === 'www.supabase.com' || databaseUrl.pathname !== '/' || databaseUrl.search || databaseUrl.hash || databaseUrl.username || databaseUrl.password || !['https:', 'http:'].includes(databaseUrl.protocol)) {
    throw new HttpError(503, 'SUPABASE_URL must be your project API URL (https://your-project-id.supabase.co), not the Supabase dashboard URL or a /rest/v1 path.', 'storage_url_invalid')
  }
  const result = await fetch(`${databaseUrl.origin}/rest/v1/${path}`, {
    method, headers: { apikey: c.databaseKey, Authorization: `Bearer ${c.databaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000),
  })
  let data
  try { data = await result.json() }
  catch {
    throw new HttpError(503, 'The database returned an invalid response. Check that SUPABASE_URL is your project API URL (https://your-project-id.supabase.co), not the dashboard URL.', 'storage_invalid_response')
  }
  if (!result.ok) {
    if (data?.code === '23505') throw new HttpError(409, 'This operation conflicts with an existing record.', 'conflict')
    if (result.status === 401 || result.status === 403) throw new HttpError(503, 'Database access was denied. Check SUPABASE_SERVICE_ROLE_KEY belongs to the configured Supabase project.', 'storage_credentials')
    if (data?.code === '42P01' || data?.code === 'PGRST205') throw new HttpError(503, 'Database setup is incomplete. Run the LifeOS SQL migrations in your Supabase project.', 'storage_schema')
    throw new HttpError(503, 'Cloud storage could not complete the request. Retry without discarding local changes.', 'storage_unavailable')
  }
  // Table operations use return=representation. An empty/non-array result must not
  // masquerade as a successful write; RPCs have their own scalar return types.
  if (!path.startsWith('rpc/') && !Array.isArray(data)) throw new HttpError(503, 'The database returned an unexpected result. Check SUPABASE_URL and the LifeOS database setup.', 'storage_invalid_response')
  return data
}
export const filter = value => encodeURIComponent(String(value))
export async function bodyJson(req, max = 512_000) {
  if (req.body !== undefined) {
    if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) > max) throw new HttpError(413, 'Request is too large.')
    try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body } catch { throw new HttpError(400, 'Invalid JSON.') }
  }
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (Buffer.byteLength(body) > max) throw new HttpError(413, 'Request is too large.')
  }
  try { return body ? JSON.parse(body) : {} } catch { throw new HttpError(400, 'Invalid JSON.') }
}
export function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(data))
}
export function cookie(req, name) {
  return cookies(req, name)[0] || ''
}
// All non-empty values for a cookie name. Browsers send duplicates when cookies differ by Path.
export function cookies(req, name) {
  return String(req.headers.cookie || '').split(';').map(p => p.trim()).filter(p => p.startsWith(`${name}=`)).map(p => p.slice(name.length + 1)).filter(Boolean)
}
export function setCookie(res, name, value, seconds) {
  const secure = config().origin.startsWith('https://') ? '; Secure' : ''
  const item = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`
  const existing = res.getHeader('Set-Cookie') || []
  res.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : [existing]), item])
}
export function assertOwner(record, owner) {
  if (!record || record.owner_id !== owner) throw new HttpError(404, 'Record not found.')
  return record
}
export function assertCsrf(req, session) {
  if (req.headers.origin !== config().origin || !safeEqual(req.headers['x-lifeos-csrf'], session.csrf)) throw new HttpError(403, 'Request verification failed.', 'csrf_failed')
}
export async function authenticate(req, mutation = false) {
  const token = cookie(req, 'lifeos_session')
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(401, 'Sign in to use cloud features.', 'unauthenticated')
  const sessions = await db(`lifeos_sessions?token_hash=eq.${hash(token)}&expires_at=gt.${filter(new Date().toISOString())}&select=*`)
  const session = sessions?.[0]
  if (!session) throw new HttpError(401, 'Your app session has expired. Local changes are retained.', 'unauthenticated')
  if (mutation) assertCsrf(req, session)
  return session
}
export async function takeLease(key, ttl = 60) {
  const owner = randomToken()
  const acquired = await db('rpc/lifeos_take_lease', { method: 'POST', body: { p_key: key, p_holder: owner, p_seconds: ttl } })
  if (!acquired) throw new HttpError(409, 'Another request is in progress. Retry shortly.', 'busy')
  return () => db(`lifeos_leases?key=eq.${filter(key)}&holder=eq.${filter(owner)}`, { method: 'DELETE' })
}
