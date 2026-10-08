import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { fmtDate, fmtMonth, relativeDay } from '../format'
import { shiftDate, shiftMonthKey, monthCells, weekDates } from './calendarMath'

/**
 * ‹ Sat, 4 Oct › with a mini-month popover. unit: 'day' | 'week' | 'month' | 'year'.
 * value is YYYY-MM-DD for day/week, YYYY-MM for month, YYYY for year.
 */
export default function DateNavigator({ value, onChange, unit = 'day', today, max }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const step = n => {
    if (unit === 'day') return shiftDate(value, n)
    if (unit === 'week') return shiftDate(value, 7 * n)
    if (unit === 'month') return shiftMonthKey(value, n)
    return String(Number(value) + n)
  }
  const title = unit === 'day' ? relativeDay(value, today) === 'Today' ? `Today · ${fmtDate(value, 'day')}` : relativeDay(value, today)
    : unit === 'week' ? (() => { const w = weekDates(value); return `${fmtDate(w[0], 'day')} – ${fmtDate(w[6], 'day')}` })()
      : unit === 'month' ? fmtMonth(value) : value
  const todayValue = unit === 'month' ? today.slice(0, 7) : unit === 'year' ? today.slice(0, 4) : today
  const isCurrent = unit === 'week' ? weekDates(value).includes(today) : value === todayValue
  const next = step(1)
  const nextDisabled = max && (unit === 'year' ? next > max.slice(0, 4) : unit === 'month' ? next > max.slice(0, 7) : next > max && !(unit === 'week' && weekDates(next)[0] <= max))

  return <div className="ui-datenav" ref={ref}>
    <button type="button" aria-label={`Previous ${unit}`} onClick={() => onChange(step(-1))}><ChevronLeft size={18} /></button>
    <button type="button" className="title" aria-haspopup="dialog" aria-expanded={open} onClick={() => unit === 'day' || unit === 'week' ? setOpen(o => !o) : undefined}>
      {(unit === 'day' || unit === 'week') && <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: '-2px', opacity: .7 }} />}{title}
    </button>
    <button type="button" aria-label={`Next ${unit}`} disabled={nextDisabled} onClick={() => onChange(next)}><ChevronRight size={18} /></button>
    {!isCurrent && <button type="button" className="today" onClick={() => onChange(todayValue)}>Today</button>}
    {open && <MiniMonth value={value} today={today} max={max} onPick={d => { onChange(d); setOpen(false) }} />}
  </div>
}

function MiniMonth({ value, today, max, onPick }) {
  const [month, setMonth] = useState(value.slice(0, 7))
  return <div className="ui-minimonth" role="dialog" aria-label="Pick a date">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <button type="button" className="ui-btn ghost icon sm" aria-label="Previous month" onClick={() => setMonth(shiftMonthKey(month, -1))}><ChevronLeft size={16} /></button>
      <strong style={{ fontFamily: 'var(--font-display)' }}>{fmtMonth(month)}</strong>
      <button type="button" className="ui-btn ghost icon sm" aria-label="Next month" onClick={() => setMonth(shiftMonthKey(month, 1))}><ChevronRight size={16} /></button>
    </div>
    <div className="ui-minimonth-grid">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="wd">{w}</span>)}
      {monthCells(month).map(c => c.pad ? <span key={c.key} /> :
        <button key={c.key} type="button" aria-current={c.date === today ? 'date' : undefined} aria-selected={c.date === value}
          disabled={max && c.date > max} onClick={() => onPick(c.date)}>{c.day}</button>)}
    </div>
  </div>
}
