import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ChevronDown } from 'lucide-react'
import { useAppActions, useAppState } from '../../context/appHooks'
import { useToast } from '../../context/toastContextCore'
import { draftDayPlan, draftActualLogs } from '../../services/geminiService'
import { slotFingerprint } from '../../services/calendarService'
import { durationMinutes, planComparison, timeMinutes, validateSlots, isWasteEntry, dayCutoff, normalizeDay, summarizeDay, validateMissedReviews } from '../../utils/planning'
import { normalizeTimezone, getTodayDateKey } from '../../utils/dateTime'
import Card from './Card'
import Button from './Button'
import Modal from './Modal'
import { PlanVsActual, DayRibbon } from './TimeCharts'
import { categoryColor, formatMinutes } from '../../utils/timeColors'

const input = { width: '100%', padding: '9px 10px', borderRadius: 9, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
const row = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
const blank = () => ({ id: uuid(), activityId: uuid(), name: '', start: '09:00', end: '10:00', category: 'Study' })
function getSlotStatus(slot) {
  const today = getTodayDateKey(slot.timezone)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: slot.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  const isPastDay = slot.date < today
  const due = isPastDay || (slot.date === today && slot.end <= time)
  const inProgress = !isPastDay && slot.date === today && slot.start <= time && slot.end > time
  return { due, inProgress }
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
  const entries = normalizeDay(state.timeflow?.entries || [], date)
  const nowMin = dayCutoff(date, getTodayDateKey(timezone), timeMinutes(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())))
  const baselines = state.timeflow?.planBaselines || []
  const baseline = baselines.find(b => b.date === date)
  const [open, setOpen] = useState(false)
  const [actualsOpen, setActualsOpen] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [draftDate, setDraftDate] = useState(date)
  const [draft, setDraft] = useState([])
  const [actualDraft, setActualDraft] = useState(null)
  const comparisonMode = state.timeflow?.comparisonMode || 'current'
  const setComparisonMode = (mode) => setModule('timeflow', current => ({ ...current, comparisonMode: mode }))
  const referencePlans = comparisonMode === 'original' && baseline ? baseline.slots : plans
  const comparison = planComparison(referencePlans, entries, nowMin)
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
      const slots = result.slots.map(s => ({ id: uuid(), name: String(s.name || ''), start: String(s.start || ''), end: String(s.end || ''), category: categories.includes(s.category) ? s.category : 'Other', isWaste: isWasteEntry(s) }))
      setDraft(slots)
      setNotes([...Array.isArray(result.assumptions) ? result.assumptions : [], ...Array.isArray(result.questions) ? result.questions : []].map(String))
      // Keep malformed proposals editable; never save or sync unvalidated AI output.
      validateSlots(slots)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  function validateMissedForImport(rows) {
    const importPlans = (state.timeflow?.plans || []).filter(p => p.date === draftDate)
    const currentMinute = timeMinutes(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date())
    )
    const cutoff = dayCutoff(draftDate, getTodayDateKey(timezone), currentMinute)
    validateMissedReviews(rows, importPlans, cutoff)
  }

  async function generateActuals() {
    setBusy(true); setError('')
    try {
      const result = await draftActualLogs({ text, image: photo, date: draftDate, categories, tentativePlans: plans })
      
      const nonMissedGen = result.actuals.filter(a => a.planOutcome !== 'missed')
        if (nonMissedGen.length > 0) {
           validateSlots(nonMissedGen)
           if (nonMissedGen.some(a => timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), nowMin))) throw new Error('Actual diary entries cannot extend into future time.')
        } else if (result.actuals.length === 0) {
           throw new Error('Add at least one activity to log.')
        }
        validateMissedForImport(result.actuals)
        
        const mapped = result.actuals.map(act => ({
          ...act,
          id: uuid(),
          name: act.planOutcome === 'missed' ? 'Missed' : (act.name?.trim() || act.category),
          category: act.planOutcome === 'missed' ? 'Other' : act.category,
          isWaste: act.planOutcome !== 'missed' && isWasteEntry({ ...act, isWaste: act.isWaste ?? (plans.find(p => p.id === act.planSlotId && p.category === act.category)?.isWaste || false) })
      }))
      
      setActualDraft(mapped)
      setError('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  function commitActualDraft() {
     setBusy(true)
     try {
        const newEntries = []
        const sessions = []
        const updatedAt = new Date().toISOString()
        
        if (!actualDraft || actualDraft.length === 0) throw new Error('No entries to save.')
        validateMissedForImport(actualDraft)
        const nonMissed = actualDraft.filter(a => a.planOutcome !== 'missed')
          if (nonMissed.length > 0) {
            validateSlots(nonMissed)
            // Reject future end times
            if (nonMissed.some(a => timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), timeMinutes(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))))) throw new Error('Actual diary entries cannot extend into future time.')
            // Reject overlaps with existing manual actuals
            const retained = entries.filter(e => e.source !== 'auto-diary' && !e.ghost && e.planOutcome !== 'missed')
            const combined = [...retained, ...nonMissed]
            validateSlots(combined)
          }
          for (const act of actualDraft) {
          if (!act.start || !act.end) continue;
          
          const isStudy = act.category === 'Study' && act.planOutcome !== 'missed' && !act.isWaste
          const studySessionId = isStudy ? `plan-study-${act.id}` : null
          
          newEntries.push({
            id: act.id,
            date: draftDate,
            start: act.start,
            end: act.end,
            name: act.name,
            category: act.category,
            durationMinutes: durationMinutes(act.start, act.end),
            planSlotId: act.planSlotId,
            activityId: (() => { const matchedPlan = plans.find(p => p.id === act.planSlotId); return (matchedPlan && matchedPlan.category === act.category && matchedPlan.name.trim() === act.name.trim() && matchedPlan.activityId) ? matchedPlan.activityId : uuid(); })(),
            planOutcome: act.planOutcome || 'followed',
            deviationReason: act.deviationReason?.trim() || '',
            isWaste: act.isWaste,
            productivityScore: 3,
            mood: 3,
            source: 'auto-diary',
            ghost: act.planOutcome === 'missed',
            createdAt: updatedAt,
            updatedAt,
            studySessionId
          })
          
          if (isStudy) {
            sessions.push({
              id: studySessionId,
              date: draftDate,
              subject: 'Other',
              topic: act.name,
              durationMinutes: durationMinutes(act.start, act.end),
              focusType: 'Deep Focus',
              rating: 3,
              notes: act.deviationReason?.trim() || '',
              source: 'auto-diary',
              createdAt: updatedAt,
              updatedAt
            })
          }
        }
        
        setModule('timeflow', current => ({
          ...current,
          entries: [...(current.entries || []).filter(e => e.date !== draftDate || e.source !== 'auto-diary'), ...newEntries]
        }))
        
        setModule('study', current => {
           const oldAutoSessions = new Set((current.sessions || []).filter(s => s.date === draftDate && s.source === 'auto-diary').map(s => s.id))
           return {
             ...current,
             sessions: [...(current.sessions || []).filter(s => !oldAutoSessions.has(s.id)), ...sessions]
           }
        })
        
        setActualsOpen(false)
        setActualDraft(null)
        setText('')
        setPhoto(null)
        showToast('Actuals saved!', 'success')
     } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  function updateSlot(id, key, value) { setDraft(items => items.map(s => s.id === id ? { ...s, [key]: value } : s)) }
  function savePlan() {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate) || new Date(`${draftDate}T00:00:00Z`).toISOString().slice(0, 10) !== draftDate) throw new Error('Choose a valid plan date.')
      let slots = draft.length ? validateSlots(draft) : []
      const updatedAt = new Date().toISOString()
      setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === draftDate)
        const baselines = current.planBaselines || []
        const revisions = current.planRevisions || []
        
        let newBaselines = [...baselines]
        let existingBaseline = baselines.find(b => b.date === draftDate)
        
        const finalSlots = slots.map(s => ({ ...s, activityId: s.activityId || uuid(), name: s.name.trim(), date: draftDate, timezone, calendarEnabled, calendarEventKey: calendarEnabled && old.find(p => p.id === s.id)?.calendarEnabled === false ? uuid() : s.calendarEventKey || s.id, reminderMinutes: reminder, updatedAt, createdAt: s.createdAt || updatedAt }))

        if (!existingBaseline && (finalSlots.length > 0 || old.length > 0)) {
          const baselineSlots = old.length > 0 ? structuredClone(old) : structuredClone(finalSlots)
          existingBaseline = {
            id: uuid(),
            date: draftDate,
            timezone,
            capturedAt: updatedAt,
            origin: old.length > 0 ? 'existing-plan-snapshot' : 'first-save',
            slots: baselineSlots
          }
          newBaselines.push(existingBaseline)
        }

        const previousRevisionId = [...revisions].filter(r => r.date === draftDate).pop()?.id || null
        const newRevision = {
           id: uuid(),
           date: draftDate,
           parentRevisionId: previousRevisionId,
           createdAt: updatedAt,
           reason: "Plan edit",
           slots: structuredClone(finalSlots)
        }

        const kept = new Set(slots.map(s => s.id))
        const removed = old.filter(p => (!kept.has(p.id) || !calendarEnabled) && p.calendarEnabled)
        const pendingId = current.pendingRescheduleSlotId;
        const newDecisions = [...(current.displacedDecisions || [])];
        if (pendingId) {
          const before = old.find(p => p.id === pendingId)
          const after = finalSlots.find(p => p.id === pendingId)

          if (!before || !after) {
            throw new Error('Keep the activity while rescheduling. Use Skip to remove it.')
          }

          const timingChanged = before.start !== after.start || before.end !== after.end

          if (!timingChanged) {
            throw new Error('Change this activity’s start or end time before saving.')
          }

          newDecisions.push({
            id: uuid(),
            sourceSlotId: pendingId,
            status: 'rescheduled',
            date: updatedAt,
          })
        }
        return { ...current,
            pendingRescheduleSlotId: null,
            displacedDecisions: newDecisions,
            planBaselines: newBaselines,
            planRevisions: [...revisions, newRevision],
            plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...finalSlots],
            calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt 
          }))],
        }
      })
      setOpen(false)
      setExpanded(slots.length ? true : null)
      showToast(!slots.length ? 'Plan removed. Actual logs kept; Calendar cleanup queued.' : calendarEnabled ? 'Plan saved. Calendar sync queued.' : 'Tentative plan saved.', 'success')
    } catch (e) { setError(e.message) }
  }

  function restoreOriginalPlan() {
    if(!confirm('Overwrite your current plan with the original baseline?')) return;
    try {
      const updatedAt = new Date().toISOString()
      setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === date)
        const revisions = current.planRevisions || []
        
        // Keep baseline IDs so check-ins stay linked!
        const restoredSlots = baseline.slots.map(s => {
           const rs = { ...s, updatedAt };
           delete rs.calendarFingerprint;
           return rs;
        })
        
        const newRevision = {
           id: uuid(),
           date: date,
           parentRevisionId: [...revisions].filter(r => r.date === date).pop()?.id || null,
           createdAt: updatedAt,
           reason: "Restored to baseline",
           slots: structuredClone(restoredSlots)
        }

        const removed = old.filter(p => {
           if (!p.calendarEnabled) return false;
           const r = restoredSlots.find(s => s.id === p.id);
           return !r || !r.calendarEnabled || r.calendarEventKey !== p.calendarEventKey;
        })
        return { ...current,
          comparisonMode: 'current',
          planRevisions: [...revisions, newRevision],
          plans: [...(current.plans || []).filter(p => p.date !== date), ...restoredSlots],
          calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
        }
      })
      showToast('Restored to original plan.', 'success')
    } catch (e) { setError(e.message) }
  }
  function openCheck(slot, isExtra = false) {
    const slotActuals = entries.filter(e => e.planSlotId === slot.id && !e.ghost).sort((a,b) => timeMinutes(a.start) - timeMinutes(b.start));
    const actual = isExtra ? null : (slotActuals[0] || entries.find(e => e.planSlotId === slot.id && e.planOutcome === 'missed'));
    const lastActual = slotActuals[slotActuals.length - 1];
    setError('');
    setCheck({ 
      slot, 
      entryId: actual?.id || '', 
      outcome: isExtra ? 'changed' : (actual?.planOutcome || 'followed'), 
      name: isExtra ? slot.name : (actual?.name || slot.name), 
      start: actual?.start || (isExtra && lastActual ? lastActual.end : slot.start), 
      end: actual?.end || slot.end, 
      category: actual?.category || slot.category, 
      isWaste: actual ? isWasteEntry(actual) : isWasteEntry(slot),
      reason: isExtra ? '' : (actual?.deviationReason || '') 
    });
  }
  function openCheckSpecific(slot, actual) {
    setError('');
    setCheck({
      slot,
      entryId: actual.id,
      outcome: actual.planOutcome,
      name: actual.name,
      start: actual.start,
      end: actual.end,
      category: actual.category,
      isWaste: isWasteEntry(actual),
      reason: actual.deviationReason || ''
    });
  }
  function saveCheck() {
    try {
      const { slot, outcome, name, start, end, category, reason = '' } = check
      validateSlots([{ name, start, end }])
      if (outcome !== 'missed' && !category) throw new Error('Choose the actual category.')
      if (outcome !== 'missed' && (slot.date > getTodayDateKey(timezone) || (slot.date === getTodayDateKey(timezone) && timeMinutes(end) > nowMin))) throw new Error('Log only time that has already happened. Use Partial and set the actual end time.')
      
      const actualOutcome = outcome === 'partial' ? 'changed' : outcome;
      const conflict = outcome !== 'missed' && entries.find(e => !e.ghost && e.planOutcome !== 'missed' && e.id !== check.entryId && Math.max(timeMinutes(e.start), timeMinutes(start)) < Math.min(timeMinutes(e.end), timeMinutes(end)))
      if (conflict) throw new Error(`Overlaps “${conflict.name}”. Adjust the actual times.`)
      const updatedAt = new Date().toISOString()
      let savedActual, previousActual
      setModule('timeflow', current => {
        const existing = (current.entries || []).find(e => check.entryId && e.id === check.entryId)
        const isMissed = outcome === 'missed'
        const actual = { 
          ...existing, 
          id: existing?.id || uuid(), 
          date: slot.date, 
          start, 
          end, 
          name: isMissed ? 'Missed' : name.trim(), 
          category: isMissed ? 'Other' : category, 
          durationMinutes: durationMinutes(start, end), 
          planSlotId: slot.id, 
          planOutcome: actualOutcome,
            activityId: (category === slot.category && name.trim() === slot.name.trim() && slot.activityId) ? slot.activityId : uuid(), 
          deviationReason: reason.trim(), 
          isWaste: !isMissed && isWasteEntry({ category, isWaste: check.isWaste }), 
          productivityScore: existing?.productivityScore || 3, 
          mood: existing?.mood || 3, 
          source: 'plan-check-in',
          ghost: isMissed, 
          createdAt: existing?.createdAt || updatedAt, 
          updatedAt 
        }
        actual.studySessionId = (!isMissed && category === 'Study' && !actual.isWaste) ? existing?.studySessionId || `plan-study-${actual.id}` : null
        savedActual = actual; previousActual = existing
        const newEntries = [...(current.entries || []).filter(e => e.id !== actual.id), actual];
        
        return { ...current, entries: newEntries }
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
  const unplanned = entries.filter(e => !e.ghost && e.planOutcome !== 'missed' && !plans.some(p => p.id === e.planSlotId))
  const isOpen = expanded ?? plans.length > 0
  const chip = (text, color) => <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: `${color}1F`, color, border: `1px solid ${color}40`, whiteSpace: 'nowrap' }}>{text}</span>
  return <Card style={{ padding: 0, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => setExpanded(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="day-plan-body"
        style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', minHeight: 44 }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(56,189,248,0.14))', flexShrink: 0 }}>✦</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>Daily plan · tentative vs actual</span>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {plans.length ? <>
              {chip(`${plans.length} slot${plans.length === 1 ? '' : 's'} · ${formatMinutes(comparison.planned)}`, '#818CF8')}
              {comparison.adherence !== null && chip(`${comparison.adherence}% on plan`, comparison.adherence >= 70 ? '#34D399' : comparison.adherence >= 40 ? '#FBBF24' : '#FB7185')}
              {comparison.pending > 0 && chip(`${formatMinutes(comparison.pending)} to check in`, '#94A3B8')}
            </> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No plan yet — tap to see how it works</span>}
          </span>
        </span>
        <ChevronDown size={18} style={{ flexShrink: 0, color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
      </button>
      <div style={{ display: 'flex', gap: '8px' }}>
        {plans.length > 0 && <Button data-edit-action onClick={() => { setDraftDate(date); setActualDraft(null); setActualsOpen(true); setText(''); setPhoto(null); setError('') }} variant="secondary" style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>Log actuals</Button>}
        <Button data-edit-action onClick={editPlan} variant="secondary" style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>{plans.length ? 'Edit plan' : 'Plan my day'}</Button>
      </div>
    </div>
    {isOpen && <div id="day-plan-body" style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0' }}>Diary photo or typed notes → editable plan → Calendar reminders → actual check-ins.</p>
    {plans.length > 0 && <>
      {baseline && (
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
           <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
             Compare against: 
             <select style={{...input, width: 'auto', padding: '4px 8px'}} value={comparisonMode} onChange={e => setComparisonMode(e.target.value)}>
               <option value="current">Current plan</option>
               <option value="original">Original plan</option>
             </select>
           </label>
           {comparisonMode === 'original' && (
             <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => {
                restoreOriginalPlan()}}>Restore Original</Button>
           )}
         </div>
      )}
      <div style={{ padding: 12, borderRadius: 12, background: 'rgba(148,163,184,0.04)', border: '1px solid var(--border)', marginBottom: 12 }}>
        <PlanVsActual 
          plans={referencePlans} 
          entries={entries} nowMin={nowMin} 
        />
      </div>
      <div style={{ ...row, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>
        <span>{comparison.planned}m planned</span><span>· {comparison.followed}m followed on time</span><span>· {comparison.changed}m changed</span><span>· {comparison.pending}m awaiting check-in</span>
      </div>
      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>{comparison.adherence === null ? 'No check-ins yet' : `${comparison.adherence}% adherence (reviewed time)`}</strong>
      </div>
      <div aria-label="Plan adherence breakdown" style={{ display: 'flex', height: 10, borderRadius: 8, overflow: 'hidden', background: 'var(--border)' }}>
        {[['Followed', comparison.followed, '#34D399'], ['Changed', comparison.changed, '#FB7185'], ['Pending', comparison.pending, '#64748B']].map(([label, value, color]) => <div key={label} title={`${label}: ${value} minutes`} style={{ width: `${comparison.planned ? value / comparison.planned * 100 : 0}%`, background: color, transition: 'width .4s ease' }} />)}
      </div>
      <div style={{ ...row, gap: 12, fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        {[['Followed', '#34D399'], ['Changed', '#FB7185'], ['Pending', '#64748B']].map(([label, color]) => <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{label}</span>)}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pendingSync ? `${pendingSync} Calendar event(s) pending sync` : plans.some(p => p.calendarEnabled) ? 'Calendar up to date · reminders at start and your selected lead time' : 'Calendar sync off'} · {timezone}</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {plans.map(slot => {
            const slotActuals = entries.filter(e => e.planSlotId === slot.id && !e.ghost).sort((a,b) => timeMinutes(a.start) - timeMinutes(b.start));
            const hasActuals = slotActuals.length > 0;
            const metrics = comparison.rows.find(r => r.id === slot.id);
            const isMissedCompletely = entries.some(e => e.planSlotId === slot.id && e.planOutcome === 'missed') && !hasActuals;
            const { due, inProgress } = getSlotStatus(slot);
            const color = categoryColor(slot.category);
            
            let status = ['Upcoming', '#94A3B8'];
            if (isMissedCompletely) status = ['Missed', '#F87171'];
            else if (hasActuals) {
               if (isMissedCompletely) status = ['Missed', '#F87171'];
               else if (metrics?.pending > 0) status = ['Partial · check in', '#FBBF24'];
               else if (metrics?.changed > 0 || slotActuals.some(a => a.planOutcome === 'changed')) status = ['Changed', '#FB7185'];
               else if (slotActuals.some(a => a.planOutcome === 'followed')) status = ['Done', '#34D399'];
               else status = ['In Progress', '#60A5FA'];
            } else if (due) {
               status = ['Check in', '#FBBF24'];
            } else if (inProgress) {
               status = ['In Progress', '#60A5FA'];
            }

            return <div key={slot.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <div style={{ width: 42, flexShrink: 0, textAlign: 'right', paddingTop: 14, fontFamily: 'JetBrains Mono, monospace', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{slot.start}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{slot.end}</div>
              </div>
              <div style={{ flex: 1, padding: 12, border: '1px solid var(--border)', borderLeft: `4px solid ${color}`, borderRadius: 10, background: `${color}0A` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 14, wordBreak: 'break-word' }}>{slot.name}</strong>
                    <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{slot.category}{isWasteEntry(slot) ? ' · Waste flagged' : ''} &middot; {durationMinutes(slot.start, slot.end)}m {chip(status[0], status[1])}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <Button data-edit-action variant="secondary" onClick={() => openCheck(slot)} disabled={!hasActuals && !due && !inProgress} style={{ padding: '8px 12px', fontSize: 12.5 }}>
                      {hasActuals ? (slotActuals.length > 1 ? 'Edit check-ins' : 'Edit check-in') : (due || inProgress) ? 'Check in' : 'Upcoming'}
                    </Button>
                    {hasActuals && !isMissedCompletely && (
                      <Button variant="secondary" onClick={() => openCheck(slot, true)} style={{ padding: '4px 8px', fontSize: 11, color: 'var(--accent-indigo)', borderColor: 'rgba(99,102,241,0.2)' }}>+ Add log</Button>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 6, fontSize: 12, color: hasActuals ? 'var(--text-secondary)' : 'var(--text-muted)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!hasActuals ? (isMissedCompletely ? 'Marked missed · no actual activity logged' : 'Actual: awaiting your confirmation') : 
                     slotActuals.map((actual, idx) => (
                        <div key={actual.id} style={{ display: 'flex', flexDirection: 'column', paddingBottom: idx < slotActuals.length - 1 ? 8 : 0, borderBottom: idx < slotActuals.length - 1 ? '1px solid var(--border)' : 'none' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                               <div style={{ flex: 1, minWidth: 0 }}>
                                 {actual.planOutcome === 'missed' ? 
                                    <span><strong style={{ color: 'var(--text-primary)' }}>Actual:</strong> Missed completely</span> : 
                                    <span><strong style={{ color: 'var(--text-primary)' }}>Actual:</strong> {actual.start}–{actual.end} &middot; {actual.name} <span style={{ color: actual.planOutcome === 'followed' ? '#34D399' : '#FB7185' }}>({actual.planOutcome})</span></span>
                                 }
                               </div>
                               {slotActuals.length > 1 && (
                                   <button type="button" onClick={() => openCheckSpecific(slot, actual)} aria-label="Edit this segment" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', textDecoration: 'underline' }}>
                                     edit
                                   </button>
                               )}
                           </div>
                           {actual.deviationReason && <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>Why:</strong> {actual.deviationReason}</div>}
                        </div>
                     ))
                  }
                </div>
              </div>
            </div>
          })}
        </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Adherence compares the current saved plan. Editing the plan changes this comparison. Adherence = minutes of the same activity inside its planned slot ÷ reviewed planned minutes. Pending slots are excluded. {unplanned.length} unlinked actual {unplanned.length === 1 ? 'entry' : 'entries'} in the timeline below.</p>
    </>}
    </div>}
    <Modal isOpen={open} onClose={() => { if (!busy) { setOpen(false); if (state.timeflow?.pendingRescheduleSlotId) { setModule('timeflow', current => ({ ...current, pendingRescheduleSlotId: null })); } } }} title={`Plan your day · ${draftDate}`}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review AI assumptions and times before saving. Only saved plans sync to Calendar. Photos/notes are sent to Gemini when you generate.</p>
      <textarea
        aria-label="Tentative day plan"
        style={input}
        rows={4}
        value={text}
        onChange={e => setText(e.target.value)}
        onPaste={async e => {
          const items = e.clipboardData?.items
          if (!items) return
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile()
              if (file) {
                e.preventDefault()
                try {
                  const p = await readImage(file)
                  setPhoto(p)
                  setError('')
                } catch (err) { setError(err.message) }
                return
              }
            }
          }
        }}
        placeholder="Kal 7 baje gym... OR you can simply PASTE a photo (Ctrl+V) of your diary here!"
      />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePhoto} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={choosePhoto} />
      <div style={{ ...row, margin: '10px 0', flexWrap: 'wrap' }}><Button variant="secondary" onClick={() => fileRef.current.click()} disabled={busy}>Upload diary</Button><Button variant="secondary" onClick={() => cameraRef.current.click()} disabled={busy}>Take photo</Button><Button variant="secondary" onClick={async () => {
        try {
          const items = await navigator.clipboard.read()
          for (const item of items) {
            const imgType = item.types.find(t => t.startsWith('image/'))
            if (imgType) {
              const blob = await item.getType(imgType)
              readImage(new File([blob], 'pasted.png', { type: blob.type })).then(setPhoto).catch(e => showToast(e.message, 'error'))
              return
            }
          }
          showToast('No image in clipboard.', 'error')
        } catch { showToast('Clipboard read failed. Try Ctrl+V inside the text box.', 'error') }
      }} disabled={busy}>Paste image</Button><Button onClick={generate} disabled={busy || (!text.trim() && !photo)}>{busy ? 'Reading plan…' : 'Generate timeline'}</Button></div>
      {photo && <div style={row}><img src={photo.preview} alt="Selected diary page" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 8 }} /><button onClick={() => setPhoto(null)}>Remove photo</button></div>}
      {notes.length > 0 && <ul style={{ fontSize: 12 }}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      {(() => {
        if (!draft.length) return null;
        const ds = summarizeDay([], draftDate, 1440, draft.map(s => ({ ...s, date: draftDate })));
        return (
          <div style={{ margin: '16px 0', padding: 12, background: 'var(--bg-secondary)', borderRadius: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12 }}><strong>Productive</strong><br/><span style={{color: '#10B981'}}>{(ds.plannedProductiveMins / 60).toFixed(1)}h</span></div>
              <div style={{ fontSize: 12 }}><strong>Waste</strong><br/><span style={{color: '#EF4444'}}>{(ds.plannedWasteMins / 60).toFixed(1)}h</span></div>
              <div style={{ fontSize: 12 }}><strong>Sleep</strong><br/><span style={{color: '#8B5CF6'}}>{(ds.plannedSleepMins / 60).toFixed(1)}h</span></div>
            </div>
            <h3 style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-muted)' }}>Tentative Timeline</h3>
            <DayRibbon entries={draft} height={30} showAxis={false} />
          </div>
        );
      })()}
      <p style={{ fontSize: 12 }}>You can also build the schedule manually. Use 24:00 for midnight at the end of this day.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {draft.map((slot, i) => <div key={slot.id} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}><input type="checkbox" aria-label={`Waste ${i + 1}`} checked={isWasteEntry(slot)} onChange={e => updateSlot(slot.id, 'isWaste', e.target.checked)} /> Count as waste (keep category)</label>
          <input aria-label={`Activity ${i + 1}`} style={input} value={slot.name} onChange={e => updateSlot(slot.id, 'name', e.target.value)} placeholder="Activity name" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            <label style={{ fontSize: 12 }}>Start<input aria-label={`Start ${i + 1}`} type="time" style={input} value={slot.start} onChange={e => updateSlot(slot.id, 'start', e.target.value)} /></label>
            <label style={{ fontSize: 12 }}>End (HH:mm)<input aria-label={`End ${i + 1}`} style={input} value={slot.end} placeholder="24:00" onChange={e => updateSlot(slot.id, 'end', e.target.value)} /></label>
          </div>
          <div style={{ ...row, marginTop: 6 }}><select aria-label={`Category ${i + 1}`} style={{ ...input, width: 'auto', flex: 1 }} value={slot.category} onChange={e => updateSlot(slot.id, 'category', e.target.value)}>{[...new Set([...categories, slot.category])].map(c => <option key={c}>{c}</option>)}</select><button disabled={busy} onClick={() => setDraft(items => items.filter(s => s.id !== slot.id))}>Remove</button></div>
        </div>)}
      </div>
              <Button variant="secondary" onClick={() => setDraft(items => [...items, blank()])} disabled={busy} style={{ marginTop: 10 }}>+ Add activity</Button>
        {(() => {
          const ds = summarizeDay(draft.map(s => ({...s, planOutcome: 'followed', date: draftDate})), draftDate, 1440, []);
          return (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                <span style={{ color: '#10B981' }}>Padhai (Productive) &middot; {formatMinutes(ds.productiveMins)}</span>
                <span style={{ color: '#EF4444' }}>Waste &middot; {formatMinutes(ds.wasteMins)}</span>
              </div>
              <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                {ds.productiveMins > 0 && <div style={{ width: `${(ds.productiveMins / (ds.loggedMins || 1)) * 100}%`, background: '#10B981' }} />}
                {ds.wasteMins > 0 && <div style={{ width: `${(ds.wasteMins / (ds.loggedMins || 1)) * 100}%`, background: '#EF4444' }} />}
              </div>
              <div style={{ fontSize: 12, color: ds.loggedMins !== 1440 ? '#FBBF24' : 'var(--text-muted)', marginTop: 8 }}>
                Other / unflagged: {formatMinutes(ds.otherMins)} · Total planned: {formatMinutes(ds.loggedMins)} {ds.loggedMins !== 1440 ? '(unplanned time stays unknown)' : ''}
              </div>
            </div>
          )
        })()}
      <div style={{ marginTop: 14 }}><label><input type="checkbox" checked={calendarEnabled} onChange={e => setCalendarEnabled(e.target.checked)} /> Automatically sync to Google Calendar</label></div>
      <label style={{ display: 'block', marginTop: 8, fontSize: 12 }}>Reminder before start <select style={{ ...input, width: 'auto', display: 'inline-block', marginLeft: 8 }} value={reminder} onChange={e => setReminder(Number(e.target.value))}>{[0, 5, 10, 15, 30].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
      {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      <Button onClick={savePlan} disabled={busy || (!draft.length && !plans.length)} style={{ marginTop: 16 }}>{draft.length ? 'Save tentative plan' : 'Delete day plan (keep actual logs)'}</Button>
    </Modal>
    <Modal isOpen={actualsOpen} onClose={() => { if (!busy) setActualsOpen(false) }} title={`Log Actuals via Diary Photo`}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upload an end-of-day photo of your diary or type what you actually did. AI will match it against your tentative plan.</p>
      <textarea
        style={input}
        rows={4}
        value={text}
        onChange={e => setText(e.target.value)}
        onPaste={async e => {
          const items = e.clipboardData?.items
          if (!items) return
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile()
              if (file) {
                e.preventDefault()
                try {
                  const p = await readImage(file)
                  setPhoto(p)
                  setError('')
                } catch (err) { setError(err.message) }
                return
              }
            }
          }
        }}
        placeholder="E.g. Woke up at 7:30 instead of 7... or PASTE (Ctrl+V) a photo of your diary."
      />
      <div style={{ ...row, margin: '10px 0', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => fileRef.current.click()} disabled={busy}>Upload diary</Button>
        <Button variant="secondary" onClick={() => cameraRef.current.click()} disabled={busy}>Take photo</Button>
        <Button variant="secondary" onClick={async () => {
          try {
            const items = await navigator.clipboard.read()
            for (const item of items) {
              const imgType = item.types.find(t => t.startsWith('image/'))
              if (imgType) {
                const blob = await item.getType(imgType)
                readImage(new File([blob], 'pasted.png', { type: blob.type })).then(setPhoto).catch(e => showToast(e.message, 'error'))
                return
              }
            }
            showToast('No image in clipboard.', 'error')
          } catch { showToast('Clipboard read failed. Try Ctrl+V inside the text box.', 'error') }
        }} disabled={busy}>Paste image</Button>
        <Button onClick={generateActuals} disabled={busy || (!text.trim() && !photo)}>{busy ? 'Reading actuals…' : 'Log Actuals'}</Button>
      </div>
      {photo && <div style={row}><img src={photo.preview} alt="Selected diary page" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 8 }} /><button onClick={() => setPhoto(null)}>Remove photo</button></div>}
      {actualDraft && (
           <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
             <h4 style={{ fontSize: 13, marginBottom: 12 }}>Preview Imports (Edit if needed)</h4>
             <div style={{ display: 'grid', gap: 12 }}>
               {actualDraft.map(act => (
                 <div key={act.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <input style={{...input, padding: '4px 8px'}} value={act.name} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, name: e.target.value} : x))} />
                    <select style={{...input, padding: '4px 8px'}} value={act.category} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, category: e.target.value} : x))}>
                       {[...new Set([...categories, act.category])].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input type="time" style={{...input, padding: '4px 8px'}} value={act.start} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, start: e.target.value} : x))} />
                    <input type="time" style={{...input, padding: '4px 8px'}} value={act.end} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, end: e.target.value} : x))} />
                    <label style={{ gridColumn: '1 / -1', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                       <input type="checkbox" checked={act.isWaste} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, isWaste: e.target.checked} : x))} /> Mark as Waste
                    </label>
                 </div>
               ))}
             </div>
             <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
               <Button onClick={commitActualDraft} disabled={busy}>Confirm & Save Actuals</Button>
               <Button variant="secondary" onClick={() => setActualDraft(null)} disabled={busy}>Cancel</Button>
             </div>
           </div>
        )}
        {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      </Modal>
      <Modal isOpen={!!check} onClose={() => setCheck(null)} title="Plan check-in">
      {check && <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 8, border: '1px solid var(--accent-indigo)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Planned Activity</div>
          <div style={{ fontWeight: 600 }}>{check.slot.start} – {check.slot.end}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{check.slot.name}</div>
        </div>

        <label>
          <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Did you do this as planned?</div>
          <select style={input} value={check.outcome} onChange={e => {
            const val = e.target.value
            setCheck(c => ({
              ...c,
              outcome: val,
              name: val === 'followed' || val === 'partial' ? c.slot.name : (val === 'missed' ? 'Missed' : ''),
              category: val === 'followed' || val === 'partial' ? c.slot.category : (val === 'missed' ? 'Other' : ''),
              isWaste: val === 'followed' || val === 'partial' ? isWasteEntry(c.slot) : false,
              start: c.slot.start,
              end: c.slot.end
            }))
          }}>
            <option value="followed">Yes, same as planned</option>
            <option value="partial">Partial (times changed)</option>
            <option value="changed">No, something else</option>
            <option value="missed">No, missed it entirely</option>
          </select>
        </label>

        {check.outcome !== 'followed' && check.outcome !== 'missed' && (
          <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actual Details</div>
            
            {check.outcome === 'changed' && (
              <>
                <label style={{ fontSize: 13 }}>What did you actually do?
                  <input style={{ ...input, marginTop: 4 }} value={check.name} onChange={e => setCheck(c => ({ ...c, name: e.target.value }))} placeholder="e.g. studied maths" />
                </label>
                <label style={{ fontSize: 13 }}>Category
                  <select aria-label="Category" style={{ ...input, marginTop: 4 }} value={check.category} onChange={e => setCheck(c => ({ ...c, category: e.target.value, isWaste: isWasteEntry({ category: e.target.value }) }))}>
                    {[...new Set([...categories, 'Other', check.category])].map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Start time<input type="time" style={{ ...input, marginTop: 4 }} value={check.start} onChange={e => setCheck(c => ({ ...c, start: e.target.value }))} /></label>
              <label style={{ fontSize: 13 }}>End time (HH:mm)<input placeholder="24:00" style={{ ...input, marginTop: 4 }} value={check.end} onChange={e => setCheck(c => ({ ...c, end: e.target.value }))} /></label>
            </div>
          </div>
        )}

        {check.outcome !== 'missed' && <label><input type="checkbox" checked={isWasteEntry(check)} onChange={e => setCheck(c => ({ ...c, isWaste: e.target.checked }))} /> Count as waste (keep category)</label>}
        <label>Reflection<textarea style={input} value={check.reason} onChange={e => setCheck(c => ({ ...c, reason: e.target.value }))} /></label>
        {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
        <Button onClick={saveCheck}>Save check-in</Button>
      </div>}
    </Modal>
  </Card>
}
