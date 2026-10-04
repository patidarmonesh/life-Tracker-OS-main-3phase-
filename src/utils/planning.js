export const WASTE_CATEGORIES = ['Social Media', 'Waste Time', 'Entertainment']

export function timeMinutes(value) {
  if (value === '24:00') return 1440
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return NaN
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function durationMinutes(start, end) {
  const a = timeMinutes(start), b = timeMinutes(end)
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : 0
}

export function validateSlots(slots) {
  if (!Array.isArray(slots) || !slots.length) throw new Error('Add at least one activity.')
  const sorted = [...slots].sort((a, b) => timeMinutes(a.start) - timeMinutes(b.start))
  sorted.forEach((slot, index) => {
    if (!slot.name?.trim()) throw new Error('Every activity needs a name.')
    if (!durationMinutes(slot.start, slot.end)) throw new Error(`${slot.name}: use valid times with end after start. Split overnight activities at midnight (24:00).`)
    if (index && timeMinutes(slot.start) < timeMinutes(sorted[index - 1].end)) throw new Error(`${slot.name} overlaps the previous activity. Adjust the times.`)
  })
  return sorted
}

// Allocate each minute once. For conflicting legacy logs the latest edited entry wins.
export function summarizeTime(entries = []) {
  const minutes = Array(1440).fill(null)
  const sorted = [...entries].sort((a, b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')))
  let recorded = 0
  for (const entry of sorted) {
    const duration = durationMinutes(entry.start, entry.end)
    if (!duration) continue
    recorded += duration
    for (let i = timeMinutes(entry.start); i < timeMinutes(entry.end); i++) minutes[i] = entry
  }
  const result = { productiveMins: 0, wasteMins: 0, sleepMins: 0, loggedMins: 0, unloggedMins: 0, overlapMins: 0, categories: {} }
  for (const entry of minutes) {
    if (!entry) { result.unloggedMins++; continue }
    result.loggedMins++
    const category = entry.category || 'Other'
    result.categories[category] = (result.categories[category] || 0) + 1
    if (entry.isWaste || WASTE_CATEGORIES.includes(category)) result.wasteMins++
    else if (category === 'Sleep') result.sleepMins++
    else if (category !== 'Meals') result.productiveMins++
  }
  result.overlapMins = recorded - result.loggedMins
  return result
}

// Legacy quick-add could store overnight logs in one row. Attribute each portion
// to its calendar day without changing or deleting the stored record.
export function summarizeDay(entries = [], date) {
  const dayEntries = []
  for (const entry of entries) {
    const start = timeMinutes(entry.start), end = timeMinutes(entry.end)
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      if (entry.date === date) dayEntries.push({ ...entry, end: '24:00' })
      const nextDay = new Date(`${entry.date}T00:00:00Z`)
      if (!Number.isFinite(nextDay.getTime())) continue
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      if (nextDay.toISOString().slice(0, 10) === date && end > 0) dayEntries.push({ ...entry, start: '00:00' })
    } else if (entry.date === date) dayEntries.push(entry)
  }
  return summarizeTime(dayEntries)
}

export function planComparison(slots = [], entries = []) {
  let planned = 0, followed = 0, changed = 0, pending = 0
  const rows = slots.map(slot => {
    const minutes = durationMinutes(slot.start, slot.end)
    const actual = entries.find(e => e.planSlotId === slot.id)
    const actualMinutes = actual ? durationMinutes(actual.start, actual.end) : 0
    const matched = actual?.planOutcome === 'followed' ? Math.max(0, Math.min(timeMinutes(slot.end), timeMinutes(actual.end)) - Math.max(timeMinutes(slot.start), timeMinutes(actual.start))) : 0
    planned += minutes
    followed += matched
    if (actual) changed += minutes - matched
    else pending += minutes
    return { name: slot.name, planned: minutes, actual: actualMinutes, followed: matched }
  })
  const reviewed = planned - pending
  return { planned, followed, changed, pending, reviewed, adherence: reviewed ? Math.round(followed / reviewed * 100) : null, rows }
}
