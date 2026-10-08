import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays, PenLine, ArrowUpRight } from 'lucide-react'
import { useAppState } from '../context/appHooks'
import { buildDailySummary, assertDate, adaptActivities } from '../domain/metrics/index'
import { displayClock, latestApproved, nextDate, ownerDate, commitmentSummary } from '../domain/planning/index'
import CheckInDialog from '../components/daily/CheckInDialog'
import Button from '../components/ui/Button'
import '../components/calendar.css'

const outcomeLabel = { done: 'Done', partial: 'Partial', 'not-started': 'Did not start', other: 'Did something else' }
export default function Calendar() {
  const state = useAppState(), [params, setParams] = useSearchParams()
  const timezone = state.settings.profile.timezone, today = ownerDate(new Date(), timezone)
  let date = params.get('date') || today
  try { assertDate(date) } catch { date = today }
  const view = ['day', 'week', 'month'].includes(params.get('view')) ? params.get('view') : 'day'
  const [now, setNow] = useState(Date.now()), [checkin, setCheckin] = useState(null)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer) }, [])
  const planning = state.planning, approved = latestApproved(planning, date), blocks = approved?.blocks || []
  const summary = useMemo(() => buildDailySummary(state, date, { now, timezone }), [state, date, now, timezone])
  const activityNames = useMemo(() => new Map(adaptActivities(state, { timezone }).records.map(r => [r.id, r.description || r.name || r.title || r.subject || r.bucket])), [state, timezone])
  const answers = new Map((planning.checkins || []).filter(c => c.localDate === date).map(c => [c.blockId, c]))
  const counts = commitmentSummary(planning, date)
  const first = `${date.slice(0, 7)}-01`, offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7
  const monthDays = Array.from({ length: 42 }, (_, i) => nextDate(first, i - offset))
  const weekStart = nextDate(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => nextDate(weekStart, i))
  const dayLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const original = planning.revisions.find(r => r.id === approved?.originalRevisionId)
  const removed = (original?.blocks || []).filter(b => !blocks.some(current => current.id === b.id))
  function select(d, mode = view) { setCheckin(null); setParams({ date: d, view: mode }) }
  function shift(delta) {
    if (view !== 'month') return select(nextDate(date, delta * (view === 'week' ? 7 : 1)))
    const value = new Date(`${first}T12:00:00Z`); value.setUTCMonth(value.getUTCMonth() + delta); select(value.toISOString().slice(0, 10))
  }
  function badge(block) {
    const answer = answers.get(block.id)
    return answer ? outcomeLabel[answer.outcome] : Date.parse(block.endAt) <= now ? 'Needs check-in' : Date.parse(block.startAt) <= now ? 'Now' : 'Planned'
  }
  const highlighted = params.get('block')
  return <div className="page-stack calendar-page">
    <header className="page-header"><div><p className="eyebrow">A PLACE FOR EVERY DAY</p><h1>Your calendar.</h1><p>Give your time a shape. Keep an honest record of what happened.</p></div><Link className="button button-primary" to={`/plan?date=${date}`}><PenLine size={17}/>Write this day’s plan</Link></header>
    <section className="section-card calendar-controls"><div className="row-actions"><Button variant="ghost" aria-label="Previous period" onClick={() => shift(-1)}><ChevronLeft size={20}/></Button><Button variant="ghost" aria-label="Next period" onClick={() => shift(1)}><ChevronRight size={20}/></Button><Button variant="secondary" onClick={() => select(today, 'day')}>Today</Button><label className="field">Calendar date<input type="date" value={date} onChange={e => e.target.value && select(e.target.value)}/></label></div><div className="row-actions" role="group" aria-label="Calendar view">{['day', 'week', 'month'].map(mode => <Button key={mode} variant={mode === view ? 'primary' : 'ghost'} aria-pressed={mode === view} onClick={() => select(date, mode)}>{mode[0].toUpperCase() + mode.slice(1)}</Button>)}</div></section>
    <div className="calendar-layout"><aside className="section-card calendar-sidebar"><h2>{new Date(`${date}T12:00:00Z`).toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><div className="month-picker" role="group" aria-label="Choose a day">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="weekday">{d}</span>)}{monthDays.map(d => <button key={d} type="button" aria-label={`Open ${d}`} aria-pressed={date === d} className={`${date === d ? 'selected' : ''} ${d === today ? 'is-today' : ''} ${d.slice(0, 7) !== date.slice(0, 7) ? 'outside' : ''}`} onClick={() => select(d, 'day')}>{Number(d.slice(8))}<span className={`day-marker ${latestApproved(planning, d) ? 'has-plan' : ''}`} /></button>)}</div><div className="calendar-legend"><span><i className="legend-plan"/>Approved plan</span><span><i className="legend-actual"/>Recorded activity</span><span><i className="legend-unknown"/>Unanswered is unknown</span></div><p className="caption">{timezone}</p><Link to="/me#drive-import" className="button button-ghost">Missing old records? Import Drive</Link></aside>
    <section className="section-card calendar-main"><div className="section-heading"><div><h2>{view === 'day' ? dayLabel : view === 'week' ? `Week of ${weekStart}` : 'The month at a glance'}</h2><p className="caption">{view === 'day' ? `${counts.completed}/${counts.total} original tasks done · ${counts.total - counts.answered} unanswered` : 'Select any date to open its plan and actual activity.'}</p></div><CalendarDays size={24}/></div>
    {view === 'month' ? <div className="month-board">{monthDays.map(d => { const plan = latestApproved(planning, d); return <button type="button" key={d} onClick={() => select(d, 'day')} className={d === today ? 'is-today' : ''} aria-label={`View day ${d}`}><strong>{Number(d.slice(8))}</strong><small>{plan?.blocks.length || 0} planned</small>{plan?.blocks.slice(0, 2).map(b => <span key={b.id}>{b.startTime} {b.title}</span>)}</button> })}</div> : view === 'week' ? <div className="week-board">{weekDays.map(d => { const plan = latestApproved(planning, d); return <button type="button" key={d} onClick={() => select(d, 'day')} aria-label={`View day ${d}`}><strong>{new Date(`${d}T12:00:00Z`).toLocaleDateString('en', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })}</strong>{plan?.blocks.length ? plan.blocks.map(b => <span className="week-block" key={b.id}><small>{b.startTime}–{b.endTime}</small>{b.title}</span>) : <span className="caption">An open day</span>}</button> })}</div> : <>
      <div className="calendar-day-columns"><div><h3>PLANNED</h3>{blocks.length ? blocks.map(b => <article key={b.id} className={`calendar-event ${answers.get(b.id)?.outcome === 'done' ? 'event-done' : ''} ${highlighted === b.id ? 'highlighted' : ''}`}><div className="row-actions"><time>{b.startTime}–{b.endTime}{b.endsNextDay ? ' +1 day' : ''}</time><span className="badge">{badge(b)}</span></div><h4>{b.title}</h4><p>{b.category} · {b.estimateMinutes} min</p>{answers.get(b.id)?.replacement && <p className="actual-replacement">Instead: {answers.get(b.id).replacement}</p>}{answers.get(b.id)?.reason && <p className="caption">{answers.get(b.id).reason}</p>}{Date.parse(b.startAt) <= now && <Button variant="ghost" onClick={() => setCheckin(b)}>{answers.has(b.id) ? 'Edit check-in' : 'What happened?'}</Button>}</article>) : <div className="empty-state"><CalendarDays size={28}/><h3>No approved plan yet</h3><Link to={`/plan?date=${date}`}>Write a tentative diary plan <ArrowUpRight size={14}/></Link></div>}</div>
      <div><h3>ACTUAL</h3>{summary.time.segments.filter(s => !['Unlogged', 'Future'].includes(s.bucket)).map((s, i) => <article key={i} className={`calendar-event actual-event ${s.bucket === 'Conflict' ? 'event-conflict' : ''}`}><time>{displayClock(s.startAt, timezone)}–{displayClock(s.endAt, timezone)}</time><h4>{activityNames.get(s.selectedActivityId) || s.bucket}{s.isStudy ? ' · Study' : ''}</h4><p>{Math.round(s.minutes)} minutes{s.estimated ? ' · estimated' : ''}</p></article>)}{!summary.time.segments.some(s => !['Unlogged', 'Future'].includes(s.bucket)) && <p className="calendar-empty">No timed activity recorded. Plans are not marked done just because their time has passed.</p>}<Link className="button button-ghost" to="/timeflow" state={{ selectedDate: date }}>Log or correct actual time <ArrowUpRight size={14}/></Link>{summary.time.durationOnly.length > 0 && <p className="caption">{summary.time.durationOnly.length} duration-only records retained with unknown clock times.</p>}</div></div>
      {removed.length > 0 && <details><summary>Original commitments removed during replanning ({removed.length})</summary>{removed.map(b => <p key={b.id}>{b.startTime} · {b.title}</p>)}</details>}
      <p className="notice">Google reminders come from the “LifeOS Plan” calendar after export. Enable that calendar and its notifications in your Google Calendar app. Tap the LifeOS check-in link inside an event to record the outcome.</p>
    </>}
    </section></div>{checkin && <CheckInDialog key={checkin.id} block={checkin} onClose={() => setCheckin(null)}/>}
  </div>
}
