Created At: 2026-10-04T23:24:36+05:30
Completed At: 2026-10-04T23:24:37+05:30
File Path: `file:///c:/Users/mayan/Downloads/antigravity%20working/life-Tracker-OS-main-3phase--main_old/src/components/ui/DayPlanner.jsx`
Total Lines: 201
Total Bytes: 19245
Showing lines 1 to 201
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import { useEffect, useRef, useState } from 'react'
2: import { v4 as uuid } from 'uuid'
3: import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
4: import { useAppActions, useAppState } from '../../context/appHooks'
5: import { useToast } from '../../context/toastContextCore'
6: import { draftDayPlan } from '../../services/geminiService'
7: import { slotFingerprint } from '../../services/calendarService'
8: import { durationMinutes, planComparison, timeMinutes, validateSlots, WASTE_CATEGORIES } from '../../utils/planning'
9: import { normalizeTimezone, getTodayDateKey } from '../../utils/dateTime'
10: import Card from './Card'
11: import Button from './Button'
12: import Modal from './Modal'
13: 
14: const input = { width: '100%', padding: '9px 10px', borderRadius: 9, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
15: const row = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
16: const blank = () => ({ id: uuid(), name: '', start: '09:00', end: '10:00', category: 'Study' })
17: function isDue(slot) {
18:   const today = getTodayDateKey(slot.timezone)
19:   const time = new Intl.DateTimeFormat('en-GB', { timeZone: slot.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
20:   return slot.date < today || (slot.date === today && slot.end <= time)
21: }
22: function readImage(file) {
23:   return new Promise((resolve, reject) => {
24:     if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('Choose a JPG, PNG or WebP image.'))
25:     if (file.size > 10 * 1024 * 1024) return reject(new Error('Choose an image smaller than 10 MB.'))
26:     const reader = new FileReader()
27:     reader.onerror = () => reject(new Error('Could not read photo.'))
28:     reader.onload = () => resolve({ mimeType: file.type, base64: String(reader.result).split(',')[1], name: file.name, preview: reader.result })
29:     reader.readAsDataURL(file)
30:   })
31: }
32: export default function DayPlanner({ date, categories }) {
33:   const state = useAppState()
34:   const { setModule } = useAppActions()
35:   const { showToast } = useToast()
36:   const timezone = normalizeTimezone(state.settings?.profile?.timezone)
37:   const plans = (state.timeflow?.plans || []).filter(p => p.date === date).sort((a, b) => a.start.localeCompare(b.start))
38:   const entries = (state.timeflow?.entries || []).filter(e => e.date === date)
39:   const comparison = planComparison(plans, entries)
40:   const [open, setOpen] = useState(false)
41:   const [draftDate, setDraftDate] = useState(date)
42:   const [draft, setDraft] = useState([])
43:   const [text, setText] = useState('')
44:   const [photo, setPhoto] = useState(null)
45:   const [notes, setNotes] = useState([])
46:   const [busy, setBusy] = useState(false)
47:   const [error, setError] = useState('')
48:   const [calendarEnabled, setCalendarEnabled] = useState(true)
49:   const [reminder, setReminder] = useState(10)
50:   const [check, setCheck] = useState(null)
51:   const fileRef = useRef(null), cameraRef = useRef(null)
52:   const [, setTick] = useState(0)
53:   useEffect(() => { const timer = setInterval(() => setTick(n => n + 1), 60000); return () => clearInterval(timer) }, [])
54: 
55:   function editPlan() {
56:     setDraftDate(date); setDraft(plans.length ? plans.map(p => ({ ...p })) : [blank()])
57:     setText(''); setPhoto(null); setNotes([]); setError('')
58:     setCalendarEnabled(plans[0]?.calendarEnabled ?? true); setReminder(plans[0]?.reminderMinutes ?? 10); setOpen(true)
59:   }
60:   async function choosePhoto(event) {
61:     const file = event.target.files?.[0]
62:     event.target.value = ''
63:     if (!file) return
64:     try { setPhoto(await readImage(file)); setError('') } catch (e) { setError(e.message) }
65:   }
66:   async function generate() {
67:     setBusy(true); setError('')
68:     try {
69:       const result = await draftDayPlan({ text, image: photo, date: draftDate, categories })
70:       const slots = result.slots.map(s => ({ id: uuid(), name: String(s.name || ''), start: String(s.start || ''), end: String(s.end || ''), category: categories.includes(s.category) ? s.category : categories[0] || 'Other' }))
71:       setDraft(slots)
72:       setNotes([...Array.isArray(result.assumptions) ? result.assumptions : [], ...Array.isArray(result.questions) ? result.questions : []].map(String))
73:       // Keep malformed proposals editable; never save or sync unvalidated AI output.
74:       validateSlots(slots)
75:     } catch (e) { setError(e.message) } finally { setBusy(false) }
76:   }
77:   function updateSlot(id, key, value) { setDraft(items => items.map(s => s.id === id ? { ...s, [key]: value } : s)) }
78:   function savePlan() {
79:     try {
80:       if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate) || new Date(`${draftDate}T00:00:00Z`).toISOString().slice(0, 10) !== draftDate) throw new Error('Choose a valid plan date.')
81:       const slots = draft.length ? validateSlots(draft) : []
82:       const updatedAt = new Date().toISOString()
83:       setModule('timeflow', current => {
84:         const old = (current.plans || []).filter(p => p.date === draftDate)
85:         const kept = new Set(slots.map(s => s.id))
86:         const removed = old.filter(p => (!kept.has(p.id) || !calendarEnabled) && p.calendarEnabled)
87:         return { ...current,
88:           plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...slots.map(s => ({ ...s, name: s.name.trim(), date: draftDate, timezone, calendarEnabled, calendarEventKey: calendarEnabled && old.find(p => p.id === s.id)?.calendarEnabled === false ? uuid() : s.calendarEventKey || s.id, reminderMinutes: reminder, updatedAt, createdAt: s.createdAt || updatedAt }))],
89:           calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
90:         }
91:       })
92:       setOpen(false)
93:       showToast(!slots.length ? 'Plan removed. Actual logs kept; Calendar cleanup queued.' : calendarEnabled ? 'Plan saved. Calendar sync queued.' : 'Tentative plan saved.', 'success')
94:     } catch (e) { setError(e.message) }
95:   }
96:   function openCheck(slot) {
97:     const actual = entries.find(e => e.planSlotId === slot.id)
98:     setError('')
99:     setCheck({ slot, entryId: actual?.id || '', outcome: actual?.planOutcome || 'followed', name: actual?.name || slot.name, start: actual?.start || slot.start, end: actual?.end || slot.end, category: actual?.category || slot.category, reason: actual?.deviationReason || '' })
100:   }
101:   function saveCheck() {
102:     try {
103:       const { slot, outcome, name, start, end, category, reason } = check
104:       validateSlots([{ name, start, end }])
105:       if (!isDue({ ...slot, start, end })) throw new Error('Actual time cannot be in the future. Check in after the activity ends.')
106:       const deviated = outcome !== 'followed' || start !== slot.start || end !== slot.end
107:       if (deviated && !reason.trim()) throw new Error('Please add why the plan changed.')
108:       const conflict = entries.find(e => e.id !== check.entryId && e.planSlotId !== slot.id && Math.max(timeMinutes(e.start), timeMinutes(start)) < Math.min(timeMinutes(e.end), timeMinutes(end)))
109:       if (conflict) throw new Error(`Overlaps “${conflict.name}”. Link that existing log below, or adjust the actual times.`)
110:       const updatedAt = new Date().toISOString()
111:       let savedActual, previousActual
112:       setModule('timeflow', current => {
113:         const existing = (current.entries || []).find(e => e.id === check.entryId || e.planSlotId === slot.id)
114:         const actual = { ...existing, id: existing?.id || uuid(), date: slot.date, start, end, name: name.trim(), category, durationMinutes: durationMinutes(start, end), planSlotId: slot.id, planOutcome: outcome, deviationReason: reason.trim(), isWaste: WASTE_CATEGORIES.includes(category), productivityScore: existing?.productivityScore || 3, mood: existing?.mood || 3, source: 'plan-check-in', createdAt: existing?.createdAt || updatedAt, updatedAt }
115:         actual.studySessionId = category === 'Study' ? existing?.studySessionId || `plan-study-${actual.id}` : null
116:         savedActual = actual; previousActual = existing
117:         return { ...current, entries: [...(current.entries || []).filter(e => e.id !== actual.id && e.planSlotId !== slot.id), actual] }
118:       })
119:       if (savedActual.studySessionId || previousActual?.studySessionId) setModule('study', current => {
120:         const sessions = (current.sessions || []).filter(s => s.id !== savedActual.studySessionId && s.id !== previousActual?.studySessionId)
121:         if (savedActual.studySessionId) sessions.push({ id: savedActual.studySessionId, date: slot.date, subject: (current.subjects || []).find(s => name.toLowerCase().includes(s.toLowerCase())) || 'Other', topic: name.trim(), durationMinutes: savedActual.durationMinutes, focusType: 'Deep Focus', rating: savedActual.productivityScore, notes: reason.trim(), source: 'plan-check-in', createdAt: savedActual.createdAt, updatedAt })
122:         return { ...current, sessions }
123:       })
124:       setCheck(null); showToast('Actual activity and reflection saved.', 'success')
125:     } catch (e) { setError(e.message) }
126:   }
127:   const pendingSync = plans.filter(p => p.calendarEnabled && p.calendarFingerprint !== slotFingerprint(p)).length
128:   const unplanned = entries.filter(e => !plans.some(p => p.id === e.planSlotId))
129:   return <Card>
130:     <div style={{ ...row, justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>✦ Daily plan · tentative vs actual</h3><Button onClick={editPlan} variant="secondary">{plans.length ? 'Edit plan' : 'Plan my day'}</Button></div>
131:     <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Diary photo or typed notes → editable plan → Calendar reminders → actual check-ins.</p>
132:     {plans.length > 0 && <>
133:       <div style={{ ...row, fontSize: 12, marginBottom: 12 }}>
134:         <span>{comparison.planned}m planned</span><span>· {comparison.followed}m followed on time</span><span>· {comparison.changed}m changed</span><span>· {comparison.pending}m awaiting check-in</span>
135:         <strong>{comparison.adherence === null ? 'No check-ins yet' : `${comparison.adherence}% adherence (reviewed time)`}</strong>
136:       </div>
137:       <div aria-label="Plan adherence breakdown" style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--border)' }}>
138:         {[['Followed', comparison.followed, '#34D399'], ['Changed', comparison.changed, '#FB7185'], ['Pending', comparison.pending, '#64748B']].map(([label, value, color]) => <div key={label} title={`${label}: ${value} minutes`} style={{ width: `${comparison.planned ? value / comparison.planned * 100 : 0}%`, background: color }} />)}
139:       </div>
140:       <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pendingSync ? `${pendingSync} Calendar event(s) pending sync` : plans.some(p => p.calendarEnabled) ? 'Calendar up to date · reminders at start and your selected lead time' : 'Calendar sync off'} · {timezone}</p>
141:       <div style={{ display: 'grid', gap: 8 }}>
142:         {plans.map(slot => {
143:           const actual = entries.find(e => e.planSlotId === slot.id)
144:           const due = isDue(slot)
145:           return <div key={slot.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
146:             <div style={{ ...row, justifyContent: 'space-between' }}><div><strong>{slot.start}–{slot.end} · {slot.name}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{slot.category} · {durationMinutes(slot.start, slot.end)}m</div></div>
147:               <Button variant="secondary" onClick={() => openCheck(slot)} disabled={!actual && !due}>{actual ? 'Edit check-in' : due ? 'What did you do?' : 'Upcoming'}</Button></div>
148:             <div style={{ marginTop: 6, fontSize: 12, color: actual ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{actual ? `Actual: ${actual.start}–${actual.end} · ${actual.name} (${actual.planOutcome})` : 'Actual: awaiting your confirmation'}</div>
149:             {actual?.deviationReason && <div style={{ fontSize: 12, marginTop: 4 }}>Why: {actual.deviationReason}</div>}
150:           </div>
151:         })}
152:       </div>
153:       <div style={{ height: Math.max(200, Math.min(600, plans.length * 45)), marginTop: 18 }}>
154:         <ResponsiveContainer width="100%" height="100%"><BarChart data={comparison.rows} layout="vertical" margin={{ left: 5, right: 10 }}><XAxis type="number" unit="m" /><YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="planned" name="Planned minutes" fill="#818CF8" /><Bar dataKey="actual" name="Actual minutes" fill="#38BDF8" /><Bar dataKey="followed" name="Followed on time" fill="#34D399" /></BarChart></ResponsiveContainer>
155:       </div>
156:       <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Adherence = minutes of the same activity inside its planned slot ÷ reviewed planned minutes. Pending slots are excluded. {unplanned.length} unlinked actual {unplanned.length === 1 ? 'entry' : 'entries'} in the timeline below.</p>
157:     </>}
158:     <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false) }} title={`Plan your day · ${draftDate}`}>
159:       <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review AI assumptions and times before saving. Only saved plans sync to Calendar. Photos/notes are sent to Gemini when you generate.</p>
160:       <textarea aria-label="Tentative day plan" style={input} rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Kal 7 baje gym, 9–12 study, lunch ke baad project…" />
161:       <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePhoto} />
162:       <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={choosePhoto} />
163:       <div style={{ ...row, margin: '10px 0' }}><Button variant="secondary" onClick={() => fileRef.current.click()} disabled={busy}>Upload diary</Button><Button variant="secondary" onClick={() => cameraRef.current.click()} disabled={busy}>Take photo</Button><Button onClick={generate} disabled={busy || (!text.trim() && !photo)}>{busy ? 'Reading plan…' : 'Generate timeline'}</Button></div>
164:       {photo && <div style={row}><img src={photo.preview} alt="Selected diary page" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 8 }} /><button onClick={() => setPhoto(null)}>Remove photo</button></div>}
165:       {notes.length > 0 && <ul style={{ fontSize: 12 }}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
166:       <p style={{ fontSize: 12 }}>You can also build the schedule manually. Use 24:00 for midnight at the end of this day.</p>
167:       <div style={{ display: 'grid', gap: 12 }}>
168:         {draft.map((slot, i) => <div key={slot.id} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
169:           <input aria-label={`Activity ${i + 1}`} style={input} value={slot.name} onChange={e => updateSlot(slot.id, 'name', e.target.value)} placeholder="Activity name" />
170:           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
171:             <label style={{ fontSize: 12 }}>Start<input aria-label={`Start ${i + 1}`} type="time" style={input} value={slot.start} onChange={e => updateSlot(slot.id, 'start', e.target.value)} /></label>
172:             <label style={{ fontSize: 12 }}>End (HH:mm)<input aria-label={`End ${i + 1}`} style={input} value={slot.end} placeholder="24:00" onChange={e => updateSlot(slot.id, 'end', e.target.value)} /></label>
173:           </div>
174:           <div style={{ ...row, marginTop: 6 }}><select aria-label={`Category ${i + 1}`} style={{ ...input, width: 'auto', flex: 1 }} value={slot.category} onChange={e => updateSlot(slot.id, 'category', e.target.value)}>{[...new Set([...categories, slot.category])].map(c => <option key={c}>{c}</option>)}</select><button disabled={busy} onClick={() => setDraft(items => items.filter(s => s.id !== slot.id))}>Remove</button></div>
175:         </div>)}
176:       </div>
177:       <Button variant="secondary" onClick={() => setDraft(items => [...items, blank()])} disabled={busy} style={{ marginTop: 10 }}>+ Add activity</Button>
178:       <div style={{ marginTop: 14 }}><label><input type="checkbox" checked={calendarEnabled} onChange={e => setCalendarEnabled(e.target.checked)} /> Automatically sync to Google Calendar</label></div>
179:       <label style={{ display: 'block', marginTop: 8, fontSize: 12 }}>Reminder before start <select value={reminder} onChange={e => setReminder(Number(e.target.value))}>{[0, 5, 10, 15, 30].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
180:       {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
181:       <Button onClick={savePlan} disabled={busy || (!draft.length && !plans.length)} style={{ marginTop: 16 }}>{draft.length ? 'Save tentative plan' : 'Delete day plan (keep actual logs)'}</Button>
182:     </Modal>
183:     <Modal isOpen={!!check} onClose={() => setCheck(null)} title="Plan check-in">
184:       {check && <div style={{ display: 'grid', gap: 12 }}>
185:         <p>Planned: {check.slot.start}–{check.slot.end} · {check.slot.name}</p>
186:         <label>Did you do the planned activity?<select style={input} value={check.outcome} onChange={e => setCheck(c => ({ ...c, outcome: e.target.value, name: e.target.value === 'followed' ? c.slot.name : '', category: e.target.value === 'followed' ? c.slot.category : 'Other' }))}><option value="followed">Yes, fully or partly (enter actual times)</option><option value="changed">I did something different</option><option value="missed">I did not do the planned activity</option></select></label>
187:         <label>Link an existing actual log (optional)<select style={input} value={check.entryId} onChange={e => {
188:           const actual = entries.find(item => item.id === e.target.value)
189:           setCheck(c => ({ ...c, entryId: e.target.value, ...(actual ? { name: actual.name, start: actual.start, end: actual.end, category: actual.category } : {}) }))
190:         }}><option value="">Create a new actual log</option>{entries.filter(e => !e.planSlotId || e.planSlotId === check.slot.id).map(e => <option key={e.id} value={e.id}>{e.start}–{e.end} {e.name}</option>)}</select></label>
191:         <label>What did you actually do?<input style={input} value={check.name} onChange={e => setCheck(c => ({ ...c, name: e.target.value }))} placeholder="e.g. rested, studied maths, phone calls" /></label>
192:         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><label>Actual start<input type="time" style={input} value={check.start} onChange={e => setCheck(c => ({ ...c, start: e.target.value }))} /></label><label>Actual end<input style={input} value={check.end} onChange={e => setCheck(c => ({ ...c, end: e.target.value }))} /></label></div>
193:         <label>Actual category<select style={input} value={check.category} onChange={e => setCheck(c => ({ ...c, category: e.target.value }))}>{[...new Set([...categories, 'Other', check.category])].map(c => <option key={c}>{c}</option>)}</select></label>
194:         <label>Why did the plan change? / reflection<textarea style={input} rows={3} value={check.reason} onChange={e => setCheck(c => ({ ...c, reason: e.target.value }))} placeholder="Required if activity or time changed" /></label>
195:         {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
196:         <Button onClick={saveCheck}>Save actual & reflection</Button>
197:       </div>}
198:     </Modal>
199:   </Card>
200: }
201: 
The above content shows the entire, complete file contents of the requested file.
