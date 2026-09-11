import { getAccessToken } from './authService'

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const SHARE_CONFIG_KEY = 'lifeos_share_config'

// Google API Key for public (unauthenticated) file access — CORS-compatible
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || ''

// List of modules that can be shared
export const SHAREABLE_MODULES = [
  { key: 'finance', fileName: 'finance.json', label: 'Finance', icon: '💸' },
  { key: 'study', fileName: 'study.json', label: 'Study', icon: '📚' },
  { key: 'habits', fileName: 'habits.json', label: 'Habits', icon: '✅' },
  { key: 'health', fileName: 'health.json', label: 'Health', icon: '🏥' },
  { key: 'timeflow', fileName: 'timeflow.json', label: 'Time Flow', icon: '⏱️' },
  { key: 'journal', fileName: 'journal.json', label: 'Journal', icon: '📝' },
  { key: 'wisdom', fileName: 'wisdom.json', label: 'Wisdom', icon: '🧠' },
  { key: 'goals', fileName: 'goals.json', label: 'Goals', icon: '🎯' },
]

export async function makeFilePublic(fileId) {
  const token = getAccessToken()
  const response = await fetch(`${DRIVE_API}/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'anyone', role: 'reader' })
  })
  if (!response.ok) throw new Error('Failed to make file public')
  return response.json()
}

export async function revokePublicAccess(fileId) {
  const token = getAccessToken()
  const res = await fetch(`${DRIVE_API}/${fileId}/permissions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to get permissions')
  const data = await res.json()
  const anyonePerm = data.permissions.find(p => p.type === 'anyone')
  
  if (anyonePerm) {
    const delRes = await fetch(`${DRIVE_API}/${fileId}/permissions/${anyonePerm.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!delRes.ok) throw new Error('Failed to revoke public access')
  }
}

export function generateShareLink(fileIds, modules, userName) {
  const url = new URL(`${window.location.origin}/shared`)
  url.searchParams.set('ids', fileIds.join(','))
  url.searchParams.set('modules', modules.join(','))
  url.searchParams.set('name', userName)
  
  const config = { fileIds, modules, userName, link: url.toString() }
  saveShareConfig(config)
  return url.toString()
}

/**
 * Fetches a public Google Drive file WITHOUT user authentication.
 * Uses a serverless proxy to bypass CORS, with API key fallback.
 */
export async function fetchPublicFileData(fileId) {
  // Approach 1: Serverless proxy (works on Vercel — no CORS, no API key needed)
  try {
    const proxyUrl = `${window.location.origin}/api/drive-proxy?id=${fileId}`
    const res = await fetch(proxyUrl)
    if (res.ok) {
      return await res.json()
    }
    const errData = await res.json().catch(() => ({}))
    if (res.status === 403) {
      throw new Error(errData.error || 'Access denied — file is not public or has been revoked')
    }
    if (res.status === 404) {
      throw new Error(errData.error || 'File not found — it may have been deleted')
    }
    // Don't throw yet — try fallback
    console.warn('Proxy returned', res.status, '- trying fallback')
  } catch (err) {
    if (err.message.includes('Access denied') || err.message.includes('File not found')) {
      throw err
    }
    console.warn('Proxy failed, trying API key fallback:', err.message)
  }

  // Approach 2: Direct Google Drive API with API key (CORS-compatible)
  if (GOOGLE_API_KEY) {
    const res = await fetch(
      `${DRIVE_API}/${fileId}?alt=media&key=${GOOGLE_API_KEY}`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (res.ok) {
      return await res.json()
    }
    if (res.status === 403) {
      throw new Error('Access denied — the file is not public')
    }
    if (res.status === 404) {
      throw new Error('File not found')
    }
  }

  throw new Error('Unable to load shared data. Please try again later.')
}

export function getShareConfig() {
  const stored = localStorage.getItem(SHARE_CONFIG_KEY)
  return stored ? JSON.parse(stored) : null
}

export function saveShareConfig(config) {
  localStorage.setItem(SHARE_CONFIG_KEY, JSON.stringify(config))
}

export async function isFilePublic(fileId) {
  const token = getAccessToken()
  const res = await fetch(`${DRIVE_API}/${fileId}/permissions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) return false
  const data = await res.json()
  return data.permissions?.some(p => p.type === 'anyone') || false
}

