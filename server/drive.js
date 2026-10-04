import { db, HttpError } from './core.js'
import { googleFetch } from './google.js'
import { DRIVE_MODULES } from '../src/domain/driveImport.js'

const idPattern = /^[A-Za-z0-9_-]{5,200}$/
async function requireDrive(owner) {
  const connection = (await db(`lifeos_connections?owner_id=eq.${owner}&select=scopes`))?.[0]
  if (!connection?.scopes?.split(' ').includes('https://www.googleapis.com/auth/drive.readonly')) throw new HttpError(409, 'Connect Drive import first and allow read-only access to your old files.', 'drive_not_connected')
}
async function list(owner, query) {
  const files = []
  let pageToken
  do {
    const params = new URLSearchParams({ q: query, fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)', pageSize: '100', ...(pageToken ? { pageToken } : {}) })
    const res = await googleFetch(owner, `/drive/v3/files?${params}`)
    if (!res.ok) throw new HttpError(502, 'Google Drive could not list your files. Check that Drive API is enabled.')
    const data = await res.json(); files.push(...(data.files || [])); pageToken = data.nextPageToken
    if (files.length > 1000) throw new HttpError(413, 'Too many files. Use a smaller LifeOS data folder.')
  } while (pageToken)
  return files
}
export async function driveFolders(owner, name = 'LifeOS-Data') {
  await requireDrive(owner)
  if (typeof name !== 'string' || !name.trim() || name.length > 150) throw new HttpError(400, 'Enter the old LifeOS folder name.')
  const escaped = name.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return { folders: await list(owner, `trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escaped}'`) }
}
export async function drivePreview(owner, folderId) {
  await requireDrive(owner)
  if (!idPattern.test(folderId || '')) throw new HttpError(400, 'Choose a Drive folder.')
  const files = (await list(owner, `trashed=false and '${folderId}' in parents`)).filter(file => Object.hasOwn(DRIVE_MODULES, file.name))
  return { folderId, files }
}
export async function driveRead(owner, body) {
  const { folderId, fileIds } = body
  if (!Array.isArray(fileIds) || !fileIds.length || fileIds.length > 20 || new Set(fileIds).size !== fileIds.length) throw new HttpError(400, 'Select up to 20 distinct LifeOS JSON files.')
  const preview = await drivePreview(owner, folderId)
  const selected = fileIds.map(id => preview.files.find(file => file.id === id))
  if (selected.some(file => !file)) throw new HttpError(400, 'A selected file is no longer in this folder. Refresh the preview.')
  if (new Set(selected.map(file => file.name)).size !== selected.length) throw new HttpError(400, 'Choose only one version of each module file.')
  const modules = {}, originals = [], limit = 3_000_000
  let total = 0
  for (const file of selected) {
    if (Number(file.size) > limit) throw new HttpError(413, `${file.name} is too large for this import. Download a backup and split it first.`)
    const res = await googleFetch(owner, `/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`)
    if (!res.ok) throw new HttpError(502, `Could not read ${file.name}. Your current records are unchanged.`)
    const reader = res.body.getReader(), chunks = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength; total += value.byteLength
      if (size > limit || total > limit) { await reader.cancel(); throw new HttpError(413, 'Import exceeds 3 MB. Select fewer files at a time.') }
      chunks.push(value)
    }
    let value
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HttpError(400, `${file.name} is not valid JSON.`) }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, `${file.name} must contain a LifeOS module object.`)
    modules[DRIVE_MODULES[file.name]] = value
    originals.push({ ...file, data: value })
  }
  return { ownerId: owner, folderId, modules, originals, fetchedAt: new Date().toISOString() }
}
