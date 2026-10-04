import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAppActions, useAppState } from '../../context/appHooks'
import { useToast } from '../../context/toastContextCore'
import { draftDayPlan } from '../../services/geminiService'
import { slotFingerprint } from '../../services/calendarService'
import { durationMinutes, planComparison, timeMinutes, validateSlots, WASTE_CATEGORIES } from '../../utils/planning'
import { normalizeTimezone, getTodayDateKey } from '../../utils/dateTime'
import Card from './Card'
import Button from './Button'
import Modal from './Modal'

const input = { width: '100%', padding: '9px 10px', borderRadius: 9, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
const row = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
const blank = () => ({ id: uuid(), name: '', start: '09:00', end: '10:00', category: 'Study' })
function isDue(slot) {
  const today = getTodayDateKey(slot.timezone)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: slot.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  return slot.date < today || (slot.date === today && slot.end <= time)
}
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('Choose a JPG, PNG or WebP image.'))
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Choose an image smaller than 10 MB.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read photo.'))
    reader.onload = () => resolve({ mimeType: file.type, base64: String(reader.result).split(',')[1], name: file.name, preview: reader.result })
    reader.readAsDataURL(file)
  })
}
export default function DayPlanner({ date, categories }) {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = normalizeTimezone(state.settings?.profile?.timezone)
  const plans = (state.timeflow?.plans || []).filter(p => p.date === date).sort((a, b) => a.start.localeCompare(b.start))
  const entries = (state.timeflow?.entries || []).filter(e => e.date === date)
  const comparison = planComparison(plans, entries)
  const [open, setOpen] = useState(false)
  const [draftDate, setDraftDate] = useState(date)
  const [draft, setDraft] = useState([])
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(null)
  const [notes, setNotes] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [calendarEnabled, setCalendarEnabled] = useState(true)
  const [reminder, setReminder] = useState(10)
  const [check, setCheck] = useState(null)
  const fileRef = useRef(null), cameraRef = useRef(null)
  const [, setTick] = useState(0)
  useEffect(() => { const timer = setInterval(() => setTick(n => n + 1), 60000); return () => clearInterval(timer) }, [])

  function editPlan() {
    setDraftDate(date); setDraft(plans.length ? plans.map(p => ({ ...p })) : [blank()])
    setText(''); setPhoto(null); setNotes([]); setError('')
    setCalendarEnabled(plans[0]?.calendarEnabled ?? true); setReminder(plans[0]?.reminderMinutes ?? 10); setOpen(true)
  }
  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try { setPhoto(await readImage(file)); setError('') } catch (e) { setError(e.message) }
  }
  async function generate() {
    setBusy(true); setError('')
    try {
      const result = await draftDayPlan({ text, image: photo, date: draftDate, categories })
      const slots = result.slots.map(s => ({ id: uuid(), name: String(s.name || ''), start: String(s.start || ''), end: String(s.end || ''), category: categories.includes(s.category) ? s.category : categories[0] || 'Other' }))
      setDraft(slots)
      setNotes([...Array.isArray(result.assumptions) ? result.assumptions : [], ...Array.isArray(result.questions) ? result.questions : []].map(String))
      // Keep malformed proposals editable; never save or sync unvalidated AI output.
      validateSlots(slots)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  function updateSlot(id, key, value) { setDraft(items => items.map(s => s.id === id ? { ...s, [key]: value } : s)) }
  function savePlan() {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate) || new Date(`${draftDate}T00:00:00Z`).toISOString().slice(0, 10) !== draftDate) throw new Error('Choose a valid plan date.')
      const slots = draft.length ? validateSlots(draft) : []
      const updatedAt = new Date().toISOString()
      setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === draftDate)
        const kept = new Set(slots.map(s => s.id))
        const removed = old.filter(p => (!kept.has(p.id) || !calendarEnabled) && p.calendarEnabled)
        return { ...current,
          plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...slots.map(s => ({ ...s, name: s.name.trim(), date: draftDate, timezone, calendarEnabled, calendarEventKey: calendarEnabled && old.find(p => p.id === s.id)?.calendarEnabled === false ? uuid() : s.calendarEventKey || s.id, reminderMinutes: reminder, updatedAt, createdAt: s.createdAt || updatedAt }))],
          calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
        }
      })
      setOpen(false)
      showToast(!slots.length ? 'Plan removed. Actual logs kept; Calendar cleanup queued.' : calendarEnabled ? 'Plan saved. Calendar sync queued.' : 'Tentative plan saved.', 'success')
    } catch (e) { setError(e.message) }
  }
  function openCheck(slot) {
    const actual = entries.find(e => e.planSlotId === slot.id)
    setError('')
    setCheck({ slot, entryId: actual?.id || '', outcome: actual?.planOutcome || 'followed', name: actual?.name || slot.name, start: actual?.start || slot.start, end: actual?.end || slot.end, category: actual?.category || slot.category, reason: actual?.deviationReason || '' })
  }
  function saveCheck() {
    try {
      const { slot, outcome, name, start, end, category, reason } = check
      validateSlots([{ name, start, end }])
      if (!isDue({ ...slot, start, end })) throw new Error('Actual time cannot be in the future. Check in after the activity ends.')
      const deviated = outcome !== 'followed' || start !== slot.start || end !== slot.end
      if (deviated && !reason.trim()) throw new Error('Please add why the plan changed.')
      const conflict = entries.find(e => e.id !== check.entryId && e.planSlotId !== slot.id && Math.max(timeMinutes(e.start), timeMinutes(start)) < Math.min(timeMinutes(e.end), timeMinutes(end)))
      if (conflict) throw new Error(`Overlaps “${conflict.name}”. Link that existing log below, or adjust the actual times.`)
      const updatedAt = new Date().toISOString()
      let savedActual, previousActual
      setModule('timeflow', current => {
        const existing = (current.entries || []).find(e => e.id === check.entryId || e.planSlotId === slot.id)
        const actual = { ...existing, id: existing?.id || uuid(), date: slot.date, start, end, name: name.trim(), category, durationMinutes: durationMinutes(start, end), planSlotId: slot.id, planOutcome: outcome, deviationReason: reason.trim(), isWaste: WASTE_CATEGORIES.includes(category), productivityScore: existing?.productivityScore || 3, mood: existing?.mood || 3, source: 'plan-check-in', createdAt: existing?.createdAt || updatedAt, updatedAt }
        actual.studySessionId = category === 'Study' ? existing?.studySessionId || `plan-study-${actual.id}` : null
        savedActual = actual; previousActual = existing
        return { ...current, entries: [...(current.entries || []).filter(e => e.id !== actual.id && e.planSlotId !== slot.id), actual] }
      })
      if (savedActual.studySessionId || previousActual?.studySessionId) setModule('study', current => {
        const sessions = (current.sessions || []).filter(s => s.id !== savedActual.studySessionId && s.id !== previousActual?.studySessionId)
        if (savedActual.studySessionId) sessions.push({ id: savedActual.studySessionId, date: slot.date, subject: (current.subjects || []).find(s => name.toLowerCase().includes(s.toLowerCase())) || 'Other', topic: name.trim(), durationMinutes: savedActual.durationMinutes, focusType: 'Deep Focus', rating: savedActual.productivityScore, notes: reason.trim(), source: 'plan-check-in', createdAt: savedActual.createdAt, updatedAt })
        return { ...current, sessions }
      })
      setCheck(null); showToast('Actual activity and reflection saved.', 'success')
    } catch (e) { setError(e.message) }
  }
  const pendingSync = plans.filter(p => p.calendarEnabled && p.calendarFingerprint !== slotFingerprint(p)).length
  const unplanned = entries.filter(e => !plans.some(p => p.id === e.planSlotId))
  return <Card>
    <div style={{ ...row, justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>✦ Daily plan · tentative vs actual</h3><Button onClick={editPlan} variant="secondary">{plans.length ? 'Edit plan' : 'Plan my day'}</Button></div>
    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Diary photo or typed notes → editable plan → Calendar reminders → actual check-ins.</p>
    {plans.length > 0 && <>
      <div style={{ ...row, fontSize: 12, marginBottom: 12 }}>
        <span>{comparison.planned}m planned</span><span>· {comparison.followed}m followed on time</span><span>· {comparison.changed}m changed</span><span>· {comparison.pending}m awaiting check-in</span>
        <strong>{comparison.adherence === null ? 'No check-ins yet' : `${comparison.adherence}% adherence (reviewed time)`}</strong>
      </div>
      <div aria-label="Plan adherence breakdown" style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--border)' }}>
        {[['Followed', comparison.followed, '#34D399'], ['Changed', comparison.changed, '#FB7185'], ['Pending', comparison.pending, '#64748B']].map(([label, value, color]) => <div key={label} title={`${label}: ${value} minutes`} style={{ width: `${comparison.planned ? value / comparison.planned * 100 : 0}%`, background: color }} />)}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pendingSync ? `${pendingSync} Calendar event(s) pending sync` : plans.some(p => p.calendarEnabled) ? 'Calendar up to date · reminders at start and your selected lead time' : 'Calendar sync off'} · {timezone}</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {plans.map(slot => {
          const actual = entries.find(e => e.planSlotId === slot.id)
          const due = isDue(slot)
          return <div key={slot.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ ...row, justifyContent: 'space-between' }}><div><strong>{slot.start}–{slot.end} · {slot.name}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{slot.category} · {durationMinutes(slot.start, slot.end)}m</div></div>
              <Button variant="secondary" onClick={() => openCheck(slot)} disabled={!actual && !due}>{actual ? 'Edit check-in' : due ? 'What did you do?' : 'Upcoming'}</Button></div>
            <div style={{ marginTop: 6, fontSize: 12, color: actual ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{actual ? `Actual: ${actual.start}–${actual.end} · ${actual.name} (${actual.planOutcome})` : 'Actual: awaiting your confirmation'}</div>
            {actual?.deviationReason && <div style={{ fontSize: 12, marginTop: 4 }}>Why: {actual.deviationReason}</div>}
          </div>
        })}
      </div>
      <div style={{ height: Math.max(200, Math.min(600, plans.length * 45)), marginTop: 18 }}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={comparison.rows} layout="vertical" margin={{ left: 5, right: 10 }}><XAxis type="number" unit="m" /><YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="planned" name="Planned minutes" fill="#818CF8" /><Bar dataKey="actual" name="Actual minutes" fill="#38BDF8" /><Bar dataKey="followed" name="Followed on time" fill="#34D399" /></BarChart></ResponsiveContainer>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Adherence = minutes of the same activity inside its planned slot ÷ reviewed planned minutes. Pending slots are excluded. {unplanned.length} unlinked actual {unplanned.length === 1 ? 'entry' : 'entries'} in the timeline below.</p>
    </>}
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false) }} title={`Plan your day · ${draftDate}`}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review AI assumptions and times before saving. Only saved plans sync to Calendar. Photos/notes are sent to Gemini when you generate.</p>
      <textarea aria-label="Tentative day plan" style={input} rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Kal 7 baje gym, 9–12 study, lunch ke baad project…" />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePhoto} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={choosePhoto} />
      <div style={{ ...row, margin: '10px 0' }}><Button variant="secondary" onClick={() => fileRef.current.click()} disabled={busy}>Upload diary</Button><Button variant="secondary" onClick={() => cameraRef.current.click()} disabled={busy}>Take photo</Button><Button onClick={generate} disabled={busy || (!text.trim() && !photo)}>{busy ? 'Reading plan…' : 'Generate timeline'}</Button></div>
      {photo && <div style={row}><img src={photo.preview} alt="Selected diary page" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 8 }} /><button onClick={() => setPhoto(null)}>Remove photo</button></div>}
      {notes.length > 0 && <ul style={{ fontSize: 12 }}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      <p style={{ fontSize: 12 }}>You can also build the schedule manually. Use 24:00 for midnight at the end of this day.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {draft.map((slot, i) => <div key={slot.id} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <input aria-label={`Activity ${i + 1}`} style={input} value={slot.name} onChange={e => updateSlot(slot.id, 'name', e.target.value)} placeholder="Activity name" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            <label style={{ fontSize: 12 }}>Start<input aria-label={`Start ${i + 1}`} type="time" style={input} value={slot.start} onChange={e => updateSlot(slot.id, 'start', e.target.value)} /></label>
            <label style={{ fontSize: 12 }}>End (HH:mm)<input aria-label={`End ${i + 1}`} style={input} value={slot.end} placeholder="24:00" onChange={e => updateSlot(slot.id, 'end', e.target.value)} /></label>
          </div>
          <div style={{ ...row, marginTop: 6 }}><select aria-label={`Category ${i + 1}`} style={{ ...input, width: 'auto', flex: 1 }} value={slot.category} onChange={e => updateSlot(slot.id, 'category', e.target.value)}>{[...new Set([...categories, slot.category])].map(c => <option key={c}>{c}</option>)}</select><button disabled={busy} onClick={() => setDraft(items => items.filter(s => s.id !== slot.id))}>Remove</button></div>
        </div>)}
      </div>
      <Button variant="secondary" onClick={() => setDraft(items => [...items, blank()])} disabled={busy} style={{ marginTop: 10 }}>+ Add activity</Button>
      <div style={{ marginTop: 14 }}><label><input type="checkbox" checked={calendarEnabled} onChange={e => setCalendarEnabled(e.target.checked)} /> Automatically sync to Google Calendar</label></div>
      <label style={{ display: 'block', marginTop: 8, fontSize: 12 }}>Reminder before start <select value={reminder} onChange={e => setReminder(Number(e.target.value))}>{[0, 5, 10, 15, 30].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
      {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      <Button onClick={savePlan} disabled={busy || (!draft.length && !plans.length)} style={{ marginTop: 16 }}>{draft.length ? 'Save tentative plan' : 'Delete day plan (keep actual logs)'}</Button>
    </Modal>
    <Modal isOpen={!!check} onClose={() => setCheck(null)} title="Plan check-in">
      {check && <div style={{ display: 'grid', gap: 12 }}>
        <p>Planned: {check.slot.start}–{check.slot.end} · {check.slot.name}</p>
        <label>Did you do the planned activity?<select style={input} value={check.outcome} onChange={e => setCheck(c => ({ ...c, outcome: e.target.value, name: e.target.value === 'followed' ? c.slot.name : '', category: e.target.value === 'followed' ? c.slot.category : 'Other' }))}><option value="followed">Yes, fully or partly (enter actual times)</option><option value="changed">I did something different</option><option value="missed">I did not do the planned activity</option></select></label>
        <label>Link an existing actual log (optional)<select style={input} value={check.entryId} onChange={e => {
          const actual = entries.find(item => item.id === e.target.value)
          setCheck(c => ({ ...c, entryId: e.target.value, ...(actual ? { name: actual.name, start: actual.start, end: actual.end, category: actual.category } : {}) }))
        }}><option value="">Create a new actual log</option>{entries.filter(e => !e.planSlotId || e.planSlotId === check.slot.id).map(e => <option key={e.id} value={e.id}>{e.start}–{e.end} {e.name}</option>)}</select></label>
        <label>What did you actually do?<input style={input} value={check.name} onChange={e => setCheck(c => ({ ...c, name: e.target.value }))} placeholder="e.g. rested, studied maths, phone calls" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><label>Actual start<input type="time" style={input} value={check.start} onChange={e => setCheck(c => ({ ...c, start: e.target.value }))} /></label><label>Actual end<input style={input} value={check.end} onChange={e => setCheck(c => ({ ...c, end: e.target.value }))} /></label></div>
        <label>Actual category<select style={input} value={check.category} onChange={e => setCheck(c => ({ ...c, category: e.target.value }))}>{[...new Set([...categories, 'Other', check.category])].map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Why did the plan change? / reflection<textarea style={input} rows={3} value={check.reason} onChange={e => setCheck(c => ({ ...c, reason: e.target.value }))} placeholder="Required if activity or time changed" /></label>
        {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
        <Button onClick={saveCheck}>Save actual & reflection</Button>
      </div>}
    </Modal>
  </Card>
}
