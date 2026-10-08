/**
 * Planned-vs-Actual synchronisation maths (LifeOS 3.0 plan §7).
 *
 * Vocabulary for a local date d, cutoff C = min(now, end of observation window):
 *   P_j  planned interval of block j            p_j = |P_j ∩ [B, C)|  (elapsed planned minutes)
 *   A_j  resolved actual segments linked to j    (explicit blockId / reviewed match only)
 *   O_j  on-time minutes   = |P_j ∩ A_j|
 *   S_j  shifted minutes   = min(|A_j|, p_j) − O_j
 *   U_j  unknown minutes   = elapsed planned minutes that have no evidence of any kind
 *
 * Invariants (tested): no NaN/∞, 0 ≤ O_j ≤ p_j, O_j + S_j ≤ p_j, lower ≤ upper,
 * one actual minute matches at most one block (segments carry one selected activity).
 */
import { addDays, dateRange, dayBounds, localDate, weekday } from '../metrics/dates.js'
import { adaptActivities, resolveSegments } from '../metrics/records.js'

/**
 * PRIORITY_WEIGHT
 * @description Automatically documented.
 */
export const PRIORITY_WEIGHT = { must: 2, should: 1, could: 0.5 }
/**
 * SYNC_VERSION
 * @description Automatically documented.
 */
export const SYNC_VERSION = 'lifeos-sync/3.0.0'
const MIN = 60000

const weightOf = block => PRIORITY_WEIGHT[block.priority] ?? 1
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
const round1 = value => Math.round(value * 10) / 10
const median = values => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
/** Total length of a union of [start,end) intervals (ms) intersected with [from,to). */
function unionLength(intervals, from = -Infinity, to = Infinity) {
  const clipped = intervals.map(([s, e]) => [Math.max(s, from), Math.min(e, to)]).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0])
  let total = 0, cs = null, ce = null
  for (const [s, e] of clipped) {
    if (cs === null || s > ce) { if (cs !== null) total += ce - cs; cs = s; ce = e }
    else ce = Math.max(ce, e)
  }
  return cs === null ? 0 : total + (ce - cs)
}

/** Which plan block (if any) a resolved record is evidence for. Suggested matches never count. */
/**
 * linkedBlockId function
 * @param {any} record
 * @returns {any}
 */
export function linkedBlockId(record) {
  if (!record) return null
  if (record.blockId) return record.blockId
  if (record.reviewedMatchBlockId) return record.reviewedMatchBlockId
  if (record.matchedBlockId && ['link', 'reviewed'].includes(record.matchMethod)) return record.matchedBlockId
  return null
}

/** Reusable context: adapting activities is the expensive part, do it once per state revision. */
/**
 * prepareSyncContext function
 * @param {any} state = {}, options = {}
 * @returns {any}
 */
export function prepareSyncContext(state = {}, options = {}) {
  const timezone = options.timezone || state.settings?.profile?.timezone || 'Asia/Kolkata'
  const adapted = adaptActivities(state, { timezone })
  return { state, timezone, adapted, recordMap: new Map(adapted.records.map(r => [r.id, r])), resolutions: state.timeflow?.resolutions || state.activityResolutions || [] }
}

/**
 * planRevisionsFor function
 * @param {any} planning, date
 * @returns {any}
 */
export function planRevisionsFor(planning, date) {
  const approved = (planning?.revisions || []).filter(r => r.localDate === date && r.status === 'approved').sort((a, b) => b.revision - a.revision)
  const current = approved[0] || null
  const original = current ? (planning.revisions.find(r => r.id === current.originalRevisionId) || approved.at(-1) || current) : null
  return { current, original }
}

/**
 * Full sync computation for one local date.
 * @param {object} state  app state (planning, timeflow, activities, …)
 * @param {string} date   YYYY-MM-DD
 * @param {{now?:number|string, timezone?:string, mode?:'original'|'current', context?:object}} options
 */
/**
 * computeDaySync function
 * @param {any} state = {}, date, options = {}
 * @returns {any}
 */
export function computeDaySync(state = {}, date, options = {}) {
  const context = options.context || prepareSyncContext(state, options)
  const { timezone, adapted, recordMap, resolutions } = context
  const now = options.now == null ? Date.now() : typeof options.now === 'number' ? options.now : Date.parse(options.now)
  const { current, original } = planRevisionsFor(state.planning, date)
  const revision = options.mode === 'current' ? current : original
  const blocks = (revision?.blocks || []).filter(b => Number.isFinite(Date.parse(b.startAt)) && Date.parse(b.endAt) > Date.parse(b.startAt))
  const bounds = dayBounds(date, timezone, now)
  const windowStart = Math.min(bounds.start, ...blocks.map(b => Date.parse(b.startAt)))
  const windowEnd = Math.max(bounds.end, ...blocks.map(b => Date.parse(b.endAt)))
  const cutoff = Math.max(windowStart, Math.min(now, windowEnd))
  const segments = resolveSegments(adapted.records, windowStart, cutoff, resolutions)
  const answers = new Map((state.planning?.checkins || []).filter(c => c.localDate === date).map(c => [c.blockId, c]))
  const blockIds = new Set(blocks.map(b => b.id))

  // Index evidence once: linked segments per block, all non-conflict evidence, drift, focus.
  const linked = new Map(blocks.map(b => [b.id, []]))
  const evidence = [], conflicts = [], drift = [], focus = []
  for (const s of segments) {
    const span = [Date.parse(s.startAt), Date.parse(s.endAt)]
    if (!s.selectedActivityId || s.bucket === 'Conflict') { conflicts.push(span); continue }
    evidence.push(span)
    if (s.bucket === 'Drift') drift.push({ span, record: recordMap.get(s.selectedActivityId) })
    if (s.bucket === 'Focus') focus.push(span)
    const id = linkedBlockId(recordMap.get(s.selectedActivityId))
    if (id && blockIds.has(id)) linked.get(id).push({ span, segment: s })
  }

  const details = blocks.map(block => {
    const s = Date.parse(block.startAt), e = Date.parse(block.endAt), w = weightOf(block)
    const plannedTotal = (e - s) / MIN
    const p = overlap(s, e, windowStart, cutoff) / MIN
    const spans = linked.get(block.id).map(x => x.span)
    const actual = unionLength(spans) / MIN
    const onTime = Math.min(p, unionLength(spans, s, Math.min(e, cutoff)) / MIN)
    const shifted = Math.max(0, Math.min(actual, p) - onTime)
    const answer = answers.get(block.id)
    const timingKnown = answer && (['not-started', 'other'].includes(answer.outcome) || (answer.timing && answer.timing !== 'unknown'))
    const conflicted = unionLength(conflicts, s, Math.min(e, cutoff)) > 0
    // Elapsed planned minutes with no evidence at all; an explicit check-in with known timing closes the gap.
    const uncovered = Math.max(0, p - unionLength([...evidence, ...conflicts], s, Math.min(e, cutoff)) / MIN)
    const conflictMinutes = unionLength(conflicts, s, Math.min(e, cutoff)) / MIN
    const unknown = timingKnown && !conflicted ? 0 : Math.min(p - onTime, uncovered + conflictMinutes)
    const firstStart = spans.length ? Math.min(...spans.map(x => x[0])) : null
    const lastEnd = spans.length ? Math.max(...spans.map(x => x[1])) : null
    const driftMinutes = unionLength(drift.map(d => d.span), s, Math.min(e, cutoff)) / MIN
    const driftLabels = [...new Set(drift.filter(d => overlap(d.span[0], d.span[1], s, e) > 0).map(d => d.record?.description || d.record?.category || 'Drift'))]
    const union = unionLength([[s, e], ...spans]) / MIN
    const due = e <= now, started = s <= now
    const outcome = answer?.outcome || 'unknown'
    let status
    if (!started) status = 'future'
    else if (outcome === 'other') status = 'replaced'
    else if (outcome === 'not-started' && actual === 0) status = 'skipped'
    else if (!spans.length) status = unknown > 0 ? 'unknown' : outcome === 'done' ? 'done-untimed' : 'missed'
    else if (firstStart - s > 10 * MIN && onTime > 0) status = 'late'
    else if (onTime === 0 && actual > 0) status = 'shifted'
    else if (lastEnd - e > 10 * MIN) status = 'ran-over'
    else status = 'on-time'
    return {
      blockId: block.id, title: block.title, category: block.category, priority: block.priority || 'should', weight: w,
      startAt: block.startAt, endAt: block.endAt, plannedMinutes: plannedTotal, elapsedPlannedMinutes: p,
      onTimeMinutes: onTime, shiftedMinutes: shifted, actualMinutes: actual, unknownMinutes: unknown,
      driftMinutes, driftLabels, conflicted, timingKnown: Boolean(timingKnown), outcome, answered: Boolean(answer), due, started, status,
      startDelayMinutes: firstStart == null ? null : (firstStart - s) / MIN,
      overrunMinutes: lastEnd == null ? null : Math.max(0, (lastEnd - e) / MIN),
      blockFit: union > 0 ? onTime / union : null,
      actualSpans: spans.map(([a, b]) => ({ startAt: new Date(a).toISOString(), endAt: new Date(b).toISOString(), minutes: (b - a) / MIN })),
      derailReason: answer?.derailReason || answer?.reason || null, replacement: answer?.replacement || null,
      originalEstimateMinutes: block.originalEstimateMinutes ?? block.estimateMinutes ?? plannedTotal,
    }
  })

  const sumW = key => details.reduce((n, d) => n + d.weight * d[key], 0)
  const denominator = sumW('elapsedPlannedMinutes')
  const onTimeW = sumW('onTimeMinutes'), unknownW = sumW('unknownMinutes'), shiftedW = sumW('shiftedMinutes')
  const ratio = (num, den) => den > 0 ? Math.min(1, Math.max(0, num / den)) : null
  const timing = ratio(onTimeW, denominator)
  const upper = denominator > 0 ? Math.min(1, (onTimeW + unknownW) / denominator) : null
  const effort = ratio(onTimeW + shiftedW, denominator)
  const committed = details.length, done = details.filter(d => d.outcome === 'done').length
  const musts = details.filter(d => d.priority === 'must')
  const delays = details.map(d => d.startDelayMinutes).filter(v => v != null)
  const dueBlocks = details.filter(d => d.due)
  const derails = details.flatMap(d => {
    const items = []
    if (d.driftMinutes > 0) items.push({ blockId: d.blockId, kind: 'drift', minutes: d.driftMinutes, text: `Lost ${Math.round(d.driftMinutes)}m to ${d.driftLabels.join(', ') || 'drift'} during ${d.title}` })
    if (d.status === 'replaced') items.push({ blockId: d.blockId, kind: 'replaced', minutes: d.elapsedPlannedMinutes, text: `${d.title} replaced by ${d.replacement || 'something else'}` })
    if (d.status === 'skipped') items.push({ blockId: d.blockId, kind: 'skipped', minutes: d.elapsedPlannedMinutes, text: `${d.title}: did not start${d.derailReason ? ` (${d.derailReason})` : ''}` })
    if (d.status === 'unknown' && d.due) items.push({ blockId: d.blockId, kind: 'unknown', minutes: d.unknownMinutes, text: `${d.title}: no check-in yet` })
    if (d.startDelayMinutes > 10) items.push({ blockId: d.blockId, kind: 'late', minutes: d.startDelayMinutes, text: `${d.title} started ${Math.round(d.startDelayMinutes)}m late` })
    if (d.overrunMinutes > 10) items.push({ blockId: d.blockId, kind: 'overrun', minutes: d.overrunMinutes, text: `${d.title} ran over by ${Math.round(d.overrunMinutes)}m` })
    return items
  })
  const unknownPlanned = details.reduce((n, d) => n + d.unknownMinutes, 0), elapsedPlanned = details.reduce((n, d) => n + d.elapsedPlannedMinutes, 0)
  const status = !details.length ? 'no-plan' : denominator === 0 ? 'not-started' : unknownW > 0 ? 'partial' : 'complete'
  return {
    version: SYNC_VERSION, date, timezone, mode: options.mode === 'current' ? 'current' : 'original',
    revision: revision?.revision ?? null, originalRevision: original?.revision ?? null, currentRevision: current?.revision ?? null,
    windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(windowEnd).toISOString(), cutoff: new Date(cutoff).toISOString(),
    status, details, segments, derails,
    timing: { value: timing, upper, numerator: onTimeW, denominator, unknownWeighted: unknownW },
    effort: { value: effort, numerator: onTimeW + shiftedW, denominator },
    outcome: { done, committed, unknown: details.filter(d => d.outcome === 'unknown').length, partial: details.filter(d => d.outcome === 'partial').length, value: committed ? done / committed : null },
    must: { done: musts.filter(d => d.outcome === 'done').length, total: musts.length, value: musts.length ? musts.filter(d => d.outcome === 'done').length / musts.length : null },
    startDelay: { median: median(delays), punctuality: delays.length ? delays.filter(v => Math.abs(v) <= 10).length / delays.length : null, sample: delays.length },
    driftInPlanMinutes: details.reduce((n, d) => n + d.driftMinutes, 0),
    checkinResponse: { answered: dueBlocks.filter(d => d.answered).length, due: dueBlocks.length, value: dueBlocks.length ? dueBlocks.filter(d => d.answered).length / dueBlocks.length : null },
    unknownShare: elapsedPlanned > 0 ? unknownPlanned / elapsedPlanned : null,
    incomplete: elapsedPlanned > 0 && unknownPlanned / elapsedPlanned > 0.3,
    plannedMinutesTotal: details.reduce((n, d) => n + d.plannedMinutes, 0),
    focusActualMinutes: unionLength(focus) / MIN,
  }
}

/**
 * Burn-up series (plan §7.2). Samples every `stepMinutes`; values in minutes.
 * planned(t): cumulative planned, drawn for the full window (future part flagged).
 * onPlan(t):  cumulative on-time matched minutes (≤ cutoff only).
 * focus(t):   cumulative Focus minutes of any kind (≤ cutoff only).
 */
/**
 * burnUpSeries function
 * @param {any} sync, { stepMinutes = 5, from, to } = {}
 * @returns {any}
 */
export function burnUpSeries(sync, { stepMinutes = 5, from, to } = {}) {
  const start = from ? Date.parse(from) : Date.parse(sync.windowStart)
  const end = to ? Date.parse(to) : Date.parse(sync.windowEnd)
  const cutoff = Date.parse(sync.cutoff)
  const planned = sync.details.map(d => [Date.parse(d.startAt), Date.parse(d.endAt)])
  const onPlan = sync.details.flatMap(d => d.actualSpans.map(a => [Math.max(Date.parse(a.startAt), Date.parse(d.startAt)), Math.min(Date.parse(a.endAt), Date.parse(d.endAt))]).filter(([a, b]) => b > a))
  const focus = sync.segments.filter(s => s.bucket === 'Focus' && s.selectedActivityId).map(s => [Date.parse(s.startAt), Date.parse(s.endAt)])
  const drift = sync.segments.filter(s => s.bucket === 'Drift').map(s => [Date.parse(s.startAt), Date.parse(s.endAt)])
  const points = []
  for (let t = start; t <= end; t += stepMinutes * MIN) {
    const past = t <= cutoff
    points.push({
      t: new Date(t).toISOString(), ms: t, future: !past,
      planned: round1(planned.reduce((n, [s, e]) => n + overlap(s, e, start, t), 0) / MIN),
      onPlan: past ? round1(unionLength(onPlan, start, t) / MIN) : null,
      focus: past ? round1(unionLength(focus, start, t) / MIN) : null,
      drifting: past && drift.some(([s, e]) => s <= t && e > t),
    })
  }
  return points
}

/** Week/month aggregation: ratio of sums, never the average of daily percentages (plan §7.4). */
/**
 * aggregateSync function
 * @param {any} state, startDate, endDate, options = {}
 * @returns {any}
 */
export function aggregateSync(state, startDate, endDate, options = {}) {
  const context = options.context || prepareSyncContext(state, options)
  const days = dateRange(startDate, endDate).map(date => computeDaySync(state, date, { ...options, context }))
  const withPlan = days.filter(d => d.details.length && d.timing.denominator > 0)
  const num = withPlan.reduce((n, d) => n + d.timing.numerator, 0), den = withPlan.reduce((n, d) => n + d.timing.denominator, 0)
  const unk = withPlan.reduce((n, d) => n + d.timing.unknownWeighted, 0)
  const effortNum = withPlan.reduce((n, d) => n + d.effort.numerator, 0)
  return {
    startDate, endDate, days, daysWithPlan: withPlan.length,
    incompleteDays: withPlan.filter(d => d.incomplete).map(d => d.date),
    timing: { value: den > 0 ? num / den : null, upper: den > 0 ? Math.min(1, (num + unk) / den) : null, numerator: num, denominator: den },
    effort: { value: den > 0 ? effortNum / den : null },
    outcome: (() => { const c = withPlan.reduce((n, d) => n + d.outcome.committed, 0), dn = withPlan.reduce((n, d) => n + d.outcome.done, 0); return { done: dn, committed: c, value: c ? dn / c : null } })(),
    derailReasons: withPlan.flatMap(d => d.details.filter(x => x.derailReason).map(x => x.derailReason)).reduce((m, r) => ({ ...m, [r]: (m[r] || 0) + 1 }), {}),
  }
}

/**
 * Best-hours model (plan §7.7): weekday × hour sync rate over the last `days` days.
 * Returns cells[weekday 0..6][hour 0..23] = { planned, onTime, rate|null } (rate only when planned ≥ minPlanned).
 */
/**
 * bestHours function
 * @param {any} state, endDate, { days = 56, minPlanned = 60, ...options } = {}
 * @returns {any}
 */
export function bestHours(state, endDate, { days = 56, minPlanned = 60, ...options } = {}) {
  const context = options.context || prepareSyncContext(state, options)
  const cells = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ planned: 0, onTime: 0, rate: null })))
  const tz = context.timezone
  const hourOf = ms => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(ms))
  for (const date of dateRange(addDays(endDate, 1 - days), endDate)) {
    const sync = computeDaySync(state, date, { ...options, context })
    if (!sync.details.length) continue
    const cutoff = Date.parse(sync.cutoff)
    for (const d of sync.details) {
      const s = Date.parse(d.startAt), e = Math.min(Date.parse(d.endAt), cutoff)
      const spans = d.actualSpans.map(a => [Date.parse(a.startAt), Date.parse(a.endAt)])
      for (let t = s - (s % (60 * MIN)); t < e; t += 60 * MIN) {
        const hs = Math.max(s, t), he = Math.min(e, t + 60 * MIN)
        if (he <= hs) continue
        const dayOfWeek = weekday(localDate(hs, tz)), hour = hourOf(hs)
        cells[dayOfWeek][hour].planned += (he - hs) / MIN
        cells[dayOfWeek][hour].onTime += unionLength(spans, hs, he) / MIN
      }
    }
  }
  const ranked = []
  cells.forEach((row, wd) => row.forEach((cell, hour) => {
    if (cell.planned >= minPlanned) { cell.rate = cell.onTime / cell.planned; ranked.push({ weekday: wd, hour, ...cell }) }
  }))
  ranked.sort((a, b) => b.rate - a.rate)
  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const planned = cells.reduce((n, row) => n + row[hour].planned, 0), onTime = cells.reduce((n, row) => n + row[hour].onTime, 0)
    return { hour, planned, onTime, rate: planned >= minPlanned ? onTime / planned : null }
  })
  return { cells, ranked, byHour, best: ranked.slice(0, 3), worst: ranked.slice(-3).reverse() }
}


