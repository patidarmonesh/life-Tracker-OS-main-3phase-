/** Presentation formatters only. No maths that changes meaning lives here. */
export function fmtMinutes(min, { empty = '—' } = {}) {
  if (min == null || !Number.isFinite(min)) return empty
  const m = Math.round(min)
  if (Math.abs(m) < 60) return `${m}m`
  const h = Math.trunc(m / 60), r = Math.abs(m % 60)
  return r ? `${h}h ${r}m` : `${h}h`
}

export const fmtHours = min => (min == null || !Number.isFinite(min)) ? '—' : `${(min / 60).toFixed(min >= 600 ? 0 : 1)}h`

export function fmtPct(ratio, { digits = 0, empty = '—' } = {}) {
  if (ratio == null || !Number.isFinite(ratio)) return empty
  return `${(ratio * 100).toFixed(digits)}%`
}

/** "14:05" → "2:05 PM" (or 24h when pref). */
export function fmtClock(hhmm, { h24 = false } = {}) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (h24) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export const minutesToClock = min => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export const clockToMinutes = hhmm => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0) }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LONG_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const parts = date => { const [y, m, d] = date.split('-').map(Number); return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() } }

export function fmtDate(date, style = 'short') {
  if (!date) return ''
  const { y, m, d, wd } = parts(date)
  if (style === 'long') return `${LONG_WEEKDAYS[wd]}, ${d} ${LONG_MONTHS[m - 1]} ${y}`
  if (style === 'weekday') return `${WEEKDAYS[wd]}, ${d} ${MONTHS[m - 1]}`
  if (style === 'day') return `${d} ${MONTHS[m - 1]}`
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function fmtMonth(month, style = 'long') {
  const [y, m] = month.split('-').map(Number)
  return style === 'short' ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : `${LONG_MONTHS[m - 1]} ${y}`
}

export const monthShort = i => MONTHS[i]
export const weekdayShort = i => WEEKDAYS[i]

export function greeting(hour) {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

export function relativeDay(date, today) {
  if (date === today) return 'Today'
  const diff = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000)
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return fmtDate(date, 'weekday')
}
