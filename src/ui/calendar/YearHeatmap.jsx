import { useMemo } from 'react'
import { fmtDate, monthShort } from '../format'
import { shiftDate, mondayIndex } from './calendarMath'

/**
 * GitHub-style 53×7 year heatmap. getDay(date) → { status, cellBg, value? }.
 * Columns are Monday-first weeks; unknown days are dashed outlines, never zero-coloured.
 */
export default function YearHeatmap({ year, getDay, onSelect, selected, today, legend }) {
  const { cells, months } = useMemo(() => {
    const first = `${year}-01-01`, last = `${year}-12-31`
    const start = shiftDate(first, -mondayIndex(first))
    const out = [], monthCols = []
    let col = 0
    for (let d = start; d <= last || mondayIndex(d) !== 0; d = shiftDate(d, 1)) {
      if (mondayIndex(d) === 0 && out.length) col++
      const inYear = d.startsWith(String(year))
      out.push({ date: d, inYear, col, row: mondayIndex(d) })
      if (inYear && d.endsWith('-01')) monthCols.push({ m: Number(d.slice(5, 7)) - 1, col })
      if (d > last && mondayIndex(d) === 6) break
    }
    return { cells: out, months: monthCols }
  }, [year])
  const cols = (cells.at(-1)?.col ?? 0) + 1

  return <div className="ui-year">
    <div className="ui-year-months" style={{ gridTemplateColumns: `repeat(${cols}, 15px)` }} aria-hidden="true">
      {months.map(({ m, col }) => <span key={m} style={{ gridColumn: `${col + 1} / span 4` }}>{monthShort(m)}</span>)}
    </div>
    <div className="ui-year-grid" role="grid" aria-label={`${year} heatmap`}>
      {cells.map(c => {
        if (!c.inYear) return <span key={c.date} style={{ width: 12, height: 12 }} aria-hidden="true" />
        const info = getDay(c.date) || { status: 'unknown' }
        return <button key={c.date} type="button" data-status={info.status}
          style={{ '--cell-bg': info.cellBg, outline: c.date === selected ? '2px solid var(--accent)' : c.date === today ? '1px solid var(--text-2)' : undefined }}
          aria-label={`${fmtDate(c.date, 'long')}${info.value ? `: ${info.value}` : info.status === 'unknown' ? ': not logged' : ''}`}
          title={`${fmtDate(c.date, 'weekday')}${info.value ? ` · ${info.value}` : ''}`}
          disabled={info.status === 'future'} onClick={() => onSelect?.(c.date)} />
      })}
    </div>
    {legend}
  </div>
}
