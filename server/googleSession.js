import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events'
export function configured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL && process.env.SESSION_SECRET?.length >= 32)
}
export function origin() { return new URL(process.env.APP_URL).origin }
const key = () => createHash('sha256').update(process.env.SESSION_SECRET || '').digest()
export function seal(data) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}
export function unseal(value) {
  try {
    const bytes = Buffer.from(value || '', 'base64url')
    const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12))
    cipher.setAuthTag(bytes.subarray(12, 28))
    const data = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString())
    return data.expires > Date.now() ? data : null
  } catch { return null }
}
export function readCookie(req, name) {
  return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1)
}
export function cookie(name, value, seconds) {
  return `${name}=${value}; Path=/api/google-auth; HttpOnly; SameSite=Lax; Max-Age=${seconds}${origin().startsWith('https:') ? '; Secure' : ''}`
}
export async function exchange(params) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data.error === 'invalid_grant' ? 'Google access was revoked or expired. Please reconnect.' : 'Google token refresh failed. Please retry.')
    error.status = data.error === 'invalid_grant' ? 401 : 502
    throw error
  }
  return data
}
