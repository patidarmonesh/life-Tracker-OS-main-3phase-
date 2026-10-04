import { useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtMonth, fmtDate } from '../format'
import { pad2, daysInMonth, shiftMonthKey, monthCells } from './calendarMath'
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * HeatCalendar — the old app's signature month grid, rebuilt honest.
 * getDay(date) → { status: 'value'|'zero'|'unknown'|'future'|'hatched', value?: string, cellBg?: css, ink?: css,
 *                  badges?: string[], dots?: css[], aria?: string }
 * Unknown days are dashed & unfilled — never painted as zero.
 */
export default function HeatCalendar({ month, onMonthChange, getDay, selected, onSelect, today, title, legend, footer, compact = false, maxMonth }) {
  const cells = useMemo(() => monthCells(month), [month])
  const grid = useRef(null)
  const canNext = !maxMonth || month < maxMonth

  const focusDate = date => requestAnimationFrame(() => grid.current?.querySelector(`[data-date="${date}"]`)?.focus())
  const onKey = (e, date) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(date); return }
    if (!(e.key in moves) && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const [y, m, d] = date.split('-').map(Number)
    let next
    if (e.key === 'Home') next = `${month}-01`
    else if (e.key === 'End') next = `${month}-${pad2(daysInMonth(month))}`
    else { const t = new Date(Date.UTC(y, m - 1, d + moves[e.key])); next = t.toISOString().slice(0, 10) }
    if (next.slice(0, 7) !== month) { if (next.slice(0, 7) > month && !canNext) return; onMonthChange?.(next.slice(0, 7)) }
    focusDate(next)
  }

  const selectedInMonth = selected?.startsWith(month)
  const tabStop = selectedInMonth ? selected : today?.startsWith(month) ? today : `${month}-01`

  return <div className="ui-heat">
    <div className="ui-heat-head">
      <h3>{title || fmtMonth(month)}</h3>
      {onMonthChange && <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {today && !today.startsWith(month) && <button type="button" className="ui-btn ghost sm" onClick={() => { onMonthChange(today.slice(0, 7)); onSelect?.(today) }}>Today</button>}
        <button type="button" className="ui-btn ghost icon" aria-label="Previous month" onClick={() => onMonthChange(shiftMonthKey(month, -1))}><ChevronLeft size={18} /></button>
        <button type="button" className="ui-btn ghost icon" aria-label="Next month" disabled={!canNext} onClick={() => onMonthChange(shiftMonthKey(month, 1))}><ChevronRight size={18} /></button>
      </div>}
    </div>
    <div className="ui-heat-grid" role="grid" aria-label={`${fmtMonth(month)} calendar`} ref={grid}>
      {WD.map((w, i) => <div key={i} className="ui-heat-wd" role="columnheader" aria-label={WD_LONG[i]}>{w}</div>)}
      {cells.map((cell, i) => {
        if (cell.pad) return <div key={cell.key} className="ui-heat-cell pad" aria-hidden="true" />
        const info = getDay(cell.date) || { status: 'unknown' }
        const isFuture = info.status === 'future'
        const label = info.aria || `${fmtDate(cell.date, 'long')}${info.value ? `, ${info.value}` : info.status === 'unknown' ? ', not logged' : ''}`
        return <button key={cell.key} type="button" role="gridcell" data-date={cell.date}
          className="ui-heat-cell" data-status={info.status} data-today={cell.date === today ? 'true' : undefined}
          aria-selected={cell.date === selected} aria-label={label} tabIndex={cell.date === tabStop ? 0 : -1}
          disabled={isFuture && !info.selectableFuture}
          style={{ '--cell-bg': info.cellBg, '--cell-ink': info.ink, animationDelay: `${Math.min(i, 42) * 8}ms`, ...(compact ? { minHeight: 34, aspectRatio: 'auto' } : null) }}
          onClick={() => onSelect?.(cell.date)} onKeyDown={e => onKey(e, cell.date)}>
          <span className="d" style={{ fontSize: '11px', fontWeight: cell.date === selected || cell.date === today ? 800 : 500 }}>{cell.day}</span>
          {!compact && info.value && <span className="v" style={{ fontSize: '12px', fontWeight: 700, color: info.status === 'good' ? '#10B981' : info.status === 'bad' ? '#EF4444' : 'var(--text-1)' }}>{info.value}</span>}
          {info.badges?.length > 0 && <span className="bdg" aria-hidden="true">{info.badges.map((b, j) => <span key={j}>{b}</span>)}</span>}
          {info.dots?.length > 0 && <span className="dots" aria-hidden="true">{info.dots.slice(0, 4).map((c, j) => <i key={j} style={{ '--dot': c }} />)}</span>}
        </button>
      })}
    </div>
    {legend}
    {footer}
  </div>
}
