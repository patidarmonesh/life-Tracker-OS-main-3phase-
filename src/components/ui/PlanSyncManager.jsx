import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppActions, useAppState } from '../../context/appHooks'
import { onTokenRefresh } from '../../services/authService'
import { deletePlanEvent, slotFingerprint, syncPlanSlot } from '../../services/calendarService'
import { getTodayDateKey } from '../../utils/dateTime'

export default function PlanSyncManager() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const latest = useRef(state)
  const busy = useRef(false)
  const [tick, setTick] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => { latest.current = state }, [state])
  useEffect(() => {
    const wake = () => setTick(n => n + 1)
    const timer = setInterval(wake, 60000)
    window.addEventListener('online', wake)
    const unsubscribe = onTokenRefresh(wake)
    return () => { clearInterval(timer); window.removeEventListener('online', wake); unsubscribe() }
  }, [])
  useEffect(() => {
    async function sync() {
      if (busy.current || !navigator.onLine || !state.hydrated) return
      busy.current = true
      try {
        for (const job of latest.current.timeflow?.calendarQueue || []) {
          await deletePlanEvent(job.slotId)
          setModule('timeflow', current => ({ ...current, calendarQueue: (current.calendarQueue || []).filter(j => j.id !== job.id) }))
        }
        for (const slot of latest.current.timeflow?.plans || []) {
          const fingerprint = slotFingerprint(slot)
          if (!slot.calendarEnabled || slot.calendarFingerprint === fingerprint) continue
          const event = await syncPlanSlot(slot)
          setModule('timeflow', current => ({ ...current, plans: (current.plans || []).map(p => p.id === slot.id && slotFingerprint(p) === fingerprint ? { ...p, calendarFingerprint: fingerprint, calendarUrl: event.htmlLink, calendarSyncedAt: new Date().toISOString() } : p) }))
        }
        setError('')
      } catch (e) { setError(e.message) } finally { busy.current = false }
    }
    sync()
  }, [state.timeflow?.plans, state.timeflow?.calendarQueue, state.hydrated, tick, setModule])
  const now = new Date()
  const due = (state.timeflow?.plans || []).filter(slot => {
    if ((state.timeflow?.entries || []).some(e => e.planSlotId === slot.id)) return false
    const today = getTodayDateKey(slot.timezone)
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: slot.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
    return slot.date < today || (slot.date === today && slot.end <= time)
  }).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  if (!due.length && !error) return null
  return <div style={{ padding: '8px 20px', fontSize: 12, background: 'rgba(99,102,241,.09)', color: 'var(--text-secondary)' }} aria-live="polite">
    {due.length > 0 && <Link to="/timeflow" state={{ selectedDate: due[0].date }} style={{ color: 'var(--accent-indigo)' }}>{due.length} plan check-in{due.length > 1 ? 's' : ''} pending — did you follow “{due[0].name}”?</Link>}
    {error && <div>Calendar: {error} <button onClick={() => setTick(n => n + 1)}>Retry sync</button></div>}
  </div>
}
