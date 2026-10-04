/* Pure calendar maths (Monday-first). */
export const pad2 = n => String(n).padStart(2, '0')
export const daysInMonth = month => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() }
export const shiftMonthKey = (month, n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}` }
export const shiftDate = (date, n) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
export const mondayIndex = date => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
export const mondayOf = date => shiftDate(date, -mondayIndex(date))
export const weekDates = date => { const s = mondayOf(date); return Array.from({ length: 7 }, (_, i) => shiftDate(s, i)) }
export const monthDates = month => Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${pad2(i + 1)}`)

export function monthCells(month) {
  const lead = mondayIndex(`${month}-01`)
  const cells = Array.from({ length: lead }, (_, i) => ({ pad: true, key: `p${i}` }))
  for (const date of monthDates(month)) cells.push({ date, day: Number(date.slice(8)), key: date })
  return cells
}

/** Interpolate a 0..1 intensity into an rgba of the given hex (for heat backgrounds). */
export function heatColor(hex, t, { min = .14, max = .85 } = {}) {
  const v = Math.max(0, Math.min(1, t))
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${(min + (max - min) * v).toFixed(3)})`
}

/** Sync % → colour band (plan §6.6): ≥80 emerald, 60–79 indigo, 40–59 amber, <40 rose. */
export function syncColor(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return null
  if (ratio >= .8) return '#10B981'
  if (ratio >= .6) return '#6366F1'
  if (ratio >= .4) return '#F59E0B'
  return '#F43F5E'
}
