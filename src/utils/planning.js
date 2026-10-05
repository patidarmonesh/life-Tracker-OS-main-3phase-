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

import { reconcile } from './timeModel'

// Allocate each minute once.
export function summarizeTime(entries = [], nowMin = 1440) {
  const result = reconcile({ plans: [], entries, nowMin })
  
  const categories = {}
  let loggedMins = 0
  let wasteMins = 0
  let sleepMins = 0
  let productiveMins = 0

  Object.entries(result.byGroup).forEach(([g, v]) => {
    categories[g] = v.actual
    loggedMins += v.actual
    if (g === 'Waste Time' || g === 'waste' || WASTE_CATEGORIES.includes(g) || /waste/i.test(g)) wasteMins += v.actual
    else if (g === 'Sleep') sleepMins += v.actual
    else if (g !== 'Meals' && g !== 'maintenance') productiveMins += v.actual
  })

  const pastUnloggedMins = result.gaps.reduce((a, g) => a + g.min, 0)

  return { 
    productiveMins, 
    wasteMins, 
    sleepMins, 
    loggedMins, 
    unloggedMins: 1440 - loggedMins, 
    pastUnloggedMins,
    overlapMins: result.conflictMins, 
    categories 
  }
}

// Legacy quick-add could store overnight logs in one row. Attribute each portion
// to its calendar day without changing or deleting the stored record.
export function normalizeDay(entries = [], date) {
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
  return dayEntries
}

export function summarizeDay(entries = [], date, nowMin = 1440) {
  return summarizeTime(normalizeDay(entries, date), nowMin)
}

export function planComparison(slots = [], entries = [], nowMin = 1440) {
  const r = reconcile({ plans: slots, entries, nowMin })
  
  const rows = r.slots.map(s => ({
    name: s.name,
    planned: s.minutes,
    actual: s.lived > 0 ? (s.on + s.subs.reduce((a, b) => a + b.min, 0)) : 0,
    followed: s.on
  }))

  const planned = r.slots.reduce((a, s) => a + s.minutes, 0)
  const followed = r.slots.reduce((a, s) => a + s.on, 0)
  const pending = r.slots.reduce((a, s) => a + s.fut, 0)
  const changed = planned - followed - pending
  const reviewed = planned - pending
  
  return { 
    planned, 
    followed, 
    changed, 
    pending, 
    reviewed, 
    adherence: r.adherence, 
    rows 
  }
}
