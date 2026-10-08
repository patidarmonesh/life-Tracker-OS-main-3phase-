export const WASTE_CATEGORIES = ['Social Media', 'Timepass', 'Waste Time', 'Entertainment']

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

import { resolveMinutes, kindOf } from './timeModel.js'
export { resolveMinutes }

// Category answers what happened; this independent flag answers how it was judged.
export const isWasteEntry = (entry) => entry.isWaste === true || kindOf(entry.category).kind === 'waste'
export const isStudyEntry = (entry) => /^(study|padhai)$/i.test(entry.category || '') && !isWasteEntry(entry)
export const dayCutoff = (date, today, minute) => date < today ? 1440 : date > today ? 0 : Math.max(0, Math.min(1440, minute))

export function resolvedIntervals(entries, cutoff = 1440) {
  const mins = resolveMinutes(entries).mins
  const intervals = []
  let last = null
  for (let i = 0; i < Math.min(1440, cutoff); i++) {
    const entry = mins[i]
    if (!entry) { last = null; continue }
    if (last?.entry === entry) last.range.end = i + 1
    else { last = { entry, range: { start: i, end: i + 1 } }; intervals.push(last) }
  }
  return intervals
}

// Every category and bucket uses the same resolved, elapsed minutes.
export function summarizeTime(entries = [], nowMin = 1440, plans = []) {
  const cutoff = Math.max(0, Math.min(1440, Math.floor(nowMin)))
  const { mins, conflict } = resolveMinutes(entries)
  const planMinutes = resolveMinutes(plans).mins
  const categories = {}, plannedCategories = {}
  let unflaggedSleepMins = 0
  let loggedMins = 0, productiveMins = 0, wasteMins = 0, sleepMins = 0, otherMins = 0
  let plannedMins = 0, plannedProductiveMins = 0, plannedWasteMins = 0, plannedSleepMins = 0
  for (let i = 0; i < cutoff; i++) {
    const e = mins[i], p = planMinutes[i]
    if (e) {
      loggedMins++
      const category = e.category || 'Other'
      categories[category] = (categories[category] || 0) + 1
      if (e.category === 'Sleep') { sleepMins++; if (!isWasteEntry(e)) unflaggedSleepMins++ }
      if (isWasteEntry(e)) wasteMins++
      else if (isStudyEntry(e)) productiveMins++
      else otherMins++
    }
    if (p) {
      plannedMins++
      const category = p.category || 'Other'
      plannedCategories[category] = (plannedCategories[category] || 0) + 1
      if (p.category === 'Sleep') plannedSleepMins++
      if (isWasteEntry(p)) plannedWasteMins++
      else if (isStudyEntry(p)) plannedProductiveMins++
    }
  }
  return { productiveMins, wasteMins, sleepMins, unflaggedSleepMins, otherMins, loggedMins,
    unloggedMins: 1440 - loggedMins, pastUnloggedMins: cutoff - loggedMins, remainingMins: 1440 - cutoff,
    plannedProductiveMins, plannedWasteMins, plannedSleepMins, plannedMins,
    overlapMins: conflict.slice(0, cutoff).filter(Boolean).length, categories, plannedCategories }
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

export function summarizeDay(entries = [], date, nowMin = 1440, plans = []) {
  return summarizeTime(normalizeDay(entries, date), nowMin, normalizeDay(plans, date))
}

// Pending means unknown, even when overdue. Only actuals or explicit missed
// check-ins review a minute; a plan alone can never prove it happened.
export function planComparison(slots = [], entries = [], nowMin = 1440) {
  const cutoff = Math.max(0, Math.min(1440, Math.floor(nowMin)))
  const actual = resolveMinutes(entries).mins
  const plannedMinutes = resolveMinutes(slots).mins
  const missed = entries.filter(e => e.planOutcome === 'missed')
  const rows = slots.map(s => ({ id: s.id, name: s.name, planned: 0, actual: 0, followed: 0, changed: 0, pending: 0 }))
  const minuteStates = new Array(1440).fill(null)
  let planned = 0, followed = 0, changed = 0, pending = 0
  for (let i = 0; i < 1440; i++) {
    const p = plannedMinutes[i]
    if (!p) continue
    planned++
    const row = rows[slots.indexOf(p)]
    row.planned++
    const a = i < cutoff ? actual[i] : null
    const explicitlyMissed = i < cutoff && missed.some(e => e.planSlotId === p.id && i >= timeMinutes(e.start) && i < timeMinutes(e.end))
    const same = a && (p.activityId && a.activityId ? p.activityId === a.activityId : p.category && a.category ? p.category === a.category : a.planSlotId === p.id && a.planOutcome === 'followed')
    const status = a ? (same ? 'followed' : 'changed') : explicitlyMissed ? 'changed' : 'pending'
    minuteStates[i] = { status, plan: p, actual: a }
    if (a) row.actual++
    row[status]++
    if (status === 'followed') followed++
    else if (status === 'changed') changed++
    else pending++
  }
  const reviewed = followed + changed
  const displaced = slots.map((s, idx) => {
      const row = rows[idx];
      if (row.changed > 0 && timeMinutes(s.start) < cutoff) {
          // If the slot is in the past and has changed minutes, it's partially or fully displaced
          return {
             id: 'disp-' + s.id,
             date: s.date,
             sourceSlotId: s.id,
             activityId: s.activityId || s.id,
             name: s.name,
             affectedMinutes: row.changed,
             status: 'suggested'
          };
      }
      return null;
    }).filter(Boolean);

    return { planned, followed, changed, pending, reviewed, adherence: reviewed ? Math.round(100 * followed / reviewed) : null, rows, minuteStates, displaced }
}

export function validateMissedReviews(rows, plans, cutoff = 1440) {
  const plansById = new Map(plans.map(p => [p.id, p]))

  for (const row of rows) {
    if (row.planOutcome !== 'missed') continue

    const start = timeMinutes(row.start)
    const end = timeMinutes(row.end)

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    ) {
      throw new Error('Missed activity needs valid start/end times.')
    }

    const plan = plansById.get(row.planSlotId)

    if (!plan) {
      throw new Error('Link the missed activity to a plan for this day.')
    }

    const plannedStart = timeMinutes(plan.start)
    const plannedEnd = timeMinutes(plan.end)

    if (start < plannedStart || end > plannedEnd) {
      throw new Error(
        `Missed time must be inside ${plan.start}–${plan.end}.`
      )
    }

    if (end > cutoff) {
      throw new Error('Future planned time cannot be marked missed yet.')
    }
  }
}
