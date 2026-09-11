import { getAccessToken } from './authService'

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const SHARE_CONFIG_KEY = 'lifeos_share_config'

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
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!res.ok) throw new Error('Failed to get permissions')
  const data = await res.json()
  const anyonePerm = data.permissions.find(p => p.type === 'anyone')
  
  if (anyonePerm) {
    const delRes = await fetch(`${DRIVE_API}/${fileId}/permissions/${anyonePerm.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
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

export async function fetchPublicFileData(fileId) {
  try {
    const res = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`)
    if (!res.ok) throw new Error('Failed to fetch via uc?export')
    return await res.json()
  } catch (err) {
    try {
      const res2 = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)
      if (!res2.ok) throw new Error('Failed to fetch via alt=media')
      return await res2.json()
    } catch (err2) {
      throw new Error('File not accessible or not found')
    }
  }
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
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!res.ok) return false
  const data = await res.json()
  return data.permissions?.some(p => p.type === 'anyone') || false
}
