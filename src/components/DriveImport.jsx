import { useState } from 'react'
import { useAuth } from '../context/appContextCore'
import { useAppActions, useAppState } from '../context/appHooks'
import { apiRequest } from '../services/apiClient'
import { connectGoogle } from '../services/authService'
import { mergeDriveModules } from '../domain/driveImport'
import Button from './ui/Button'

function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function DriveImport() {
  const { user, integration, capabilities } = useAuth(), state = useAppState(), { importDrive } = useAppActions()
  const [name, setName] = useState('LifeOS-Data'), [folders, setFolders] = useState([]), [files, setFiles] = useState([]), [folderId, setFolderId] = useState('')
  const [selected, setSelected] = useState([]), [payload, setPayload] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null)
  const connected = integration?.scopes?.includes('drive.readonly') && integration.state === 'connected'
  const review = payload ? mergeDriveModules(state, payload.modules) : null
  async function run(action) { setBusy(true); setError(''); try { await action() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  async function choose(id) {
    setPayload(null); setFolderId(id); setFiles([]); setSelected([])
    const data = await apiRequest(`drive/preview?folderId=${encodeURIComponent(id)}`)
    setFiles(data.files)
    // Ambiguous duplicate names must be explicitly selected.
    setSelected(data.files.filter(f => data.files.filter(other => other.name === f.name).length === 1).map(f => f.id))
  }
  return <section className="section-card" id="drive-import"><div className="section-heading"><div><p className="eyebrow">BRING YOUR HISTORY WITH YOU</p><h2>Import old Google Drive data</h2></div><span className="badge">Read-only import</span></div>
    <p>Your old LifeOS saved finance, study, timeline and diary records as JSON files. Review and merge them into this account; the Drive originals stay untouched.</p>
    {!connected ? <><p className="caption">Drive consent is separate from sign-in. Read-only Drive access is needed to discover files created by your previous OAuth client. We only read the LifeOS files you select.</p><Button disabled={user?.isGuest || !capabilities.auth} loading={busy} onClick={() => run(() => connectGoogle('drive_import'))}>Connect Drive import</Button>{user?.isGuest && <p>Sign in first to import into your account.</p>}</> : <div className="page-stack">
      <div className="area-toolbar"><label>Old Drive folder name<input value={name} onChange={e => setName(e.target.value)}/></label><Button loading={busy} onClick={() => run(async () => { setPayload(null); setResult(null); setFiles([]); setFolderId(''); const data = await apiRequest(`drive/folders?name=${encodeURIComponent(name)}`); setFolders(data.folders); if (!data.folders.length) throw new Error('No matching folder found. Check the folder name and that you connected the same Google account used by your old app.'); if (data.folders.length === 1) await choose(data.folders[0].id) })}>Find my old data</Button></div>
      {folders.length > 1 && <label>Choose source folder<select value={folderId} onChange={e => run(() => choose(e.target.value))}><option value="">Select a folder</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name} · {f.modifiedTime?.slice(0, 10)} · {f.id.slice(-6)}</option>)}</select></label>}
      {folderId && !files.length && <p>No supported LifeOS JSON files in this folder. Check that it contains finance.json, timeflow.json, study.json or your other module files.</p>}
      {files.length > 0 && <><div className="drive-files">{files.map(f => <label key={f.id}><input type="checkbox" checked={selected.includes(f.id)} onChange={e => { setPayload(null); setSelected(e.target.checked ? [...selected, f.id] : selected.filter(id => id !== f.id)) }}/><span><strong>{f.name}</strong><small>{f.modifiedTime?.slice(0, 10)} · {Math.ceil(Number(f.size || 0) / 1024)} KB</small></span></label>)}</div><Button variant="secondary" loading={busy} disabled={!selected.length} onClick={() => run(async () => { setResult(null); setPayload(await apiRequest('drive/read', { method: 'POST', body: { folderId, fileIds: selected } })) })}>Preview selected records</Button></>}
      {payload && <div className="notice"><h3>Review before merging</h3><p>{review.added} array items to add · {review.duplicates} identical items skipped · {review.conflicts.length} differences kept in backup.</p><p className="caption">Current values win on conflicting IDs and settings. Nothing in your workspace is silently replaced. A recovery copy of both versions is saved on this device before the merge.</p><div className="row-actions"><Button variant="secondary" onClick={() => download({ ...payload, conflicts: review.conflicts }, 'lifeos-drive-originals.json')}>Download source & differences</Button><Button loading={busy} onClick={() => run(() => { const saved = importDrive(payload); setResult({ ...saved, source: payload, conflictsReport: review.conflicts }); setPayload(null) })}>Merge into my LifeOS account</Button></div></div>}
      {result && <div className="notice"><p role="status">Import saved: {result.added} items added; {result.duplicates} duplicates skipped. {result.conflicts} differences preserved in the recovery backup. Account sync will upload imported records.</p><Button variant="secondary" onClick={() => download({ source: result.source, conflicts: result.conflictsReport }, "lifeos-import-recovery.json")}>Download import recovery copy</Button></div>}
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>
}
