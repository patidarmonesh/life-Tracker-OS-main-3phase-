/**
 * Learning loop (plan §7.5–7.7): planning-fallacy correction and capacity.
 * Suggest, never auto-apply. Thresholds are deliberately conservative.
 */
import { addDays, dateRange } from '../metrics/dates.js'
import { buildDailySummary } from '../metrics/index.js'
import { computeDaySync, prepareSyncContext } from './sync.js'

/**
 * SHRINK_K
 * @description Automatically documented.
 */
export const SHRINK_K = 5
/**
 * MIN_SAMPLES_TO_SHOW
 * @description Automatically documented.
 */
export const MIN_SAMPLES_TO_SHOW = 8

const median = values => {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
/**
 * quantile function
 * @param {any} values, q
 * @returns {any}
 */
export function quantile(values, q) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b), pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Bayesian-style shrinkage toward 1.0: m̂ = (n·median + k·1)/(n + k). */
/**
 * shrunkMultiplier function
 * @param {any} ratios, k = SHRINK_K
 * @returns {any}
 */
export function shrunkMultiplier(ratios, k = SHRINK_K) {
  const n = ratios.length
  if (!n) return { multiplier: 1, median: null, n: 0, show: false }
  const med = median(ratios)
  return { multiplier: (n * med + k) / (n + k), median: med, n, show: n >= MIN_SAMPLES_TO_SHOW }
}

/**
 * Collect ratios actualEffort / originalEstimate for completed blocks with observed/confirmed timing.
 * Returns per-category (and per-subject for Study) multipliers.
 */
/**
 * estimateMultipliers function
 * @param {any} state, endDate, { days = 90, ...options } = {}
 * @returns {any}
 */
export function estimateMultipliers(state, endDate, { days = 90, ...options } = {}) {
  const context = options.context || prepareSyncContext(state, options)
  const groups = new Map()
  for (const date of dateRange(addDays(endDate, 1 - days), endDate)) {
    const sync = computeDaySync(state, date, { ...options, context })
    for (const d of sync.details) {
      if (d.outcome !== 'done' || !d.timingKnown || d.conflicted || !(d.actualMinutes > 0) || !(d.originalEstimateMinutes > 0)) continue
      const ratio = d.actualMinutes / d.originalEstimateMinutes
      if (!Number.isFinite(ratio) || ratio > 6) continue
      const key = d.category || 'Other'
      groups.set(key, [...(groups.get(key) || []), ratio])
    }
  }
  return Object.fromEntries([...groups].map(([category, ratios]) => [category, shrunkMultiplier(ratios)]))
}

/**
 * Capacity = P75 of achieved Focus minutes over the last 28 complete days with coverage ≥ 60%.
 * Falls back to the configured capacity when fewer than 10 qualifying days.
 */
/**
 * focusCapacity function
 * @param {any} state, today, { days = 28, minCoverage = 0.6, fallbackMinutes, ...options } = {}
 * @returns {any}
 */
export function focusCapacity(state, today, { days = 28, minCoverage = 0.6, fallbackMinutes, ...options } = {}) {
  const configured = fallbackMinutes ?? (Number(state.settings?.preferences?.focusCapacityMinutes) || 0)
  const samples = []
  for (const date of dateRange(addDays(today, -days), addDays(today, -1))) {
    const summary = buildDailySummary(state, date, options)
    if ((summary.time.coverage.value ?? 0) >= minCoverage && summary.time.buckets.Focus.value != null) samples.push(summary.time.buckets.Focus.value)
  }
  if (samples.length < 10) return { minutes: configured || 240, learned: false, n: samples.length, label: 'default, not learned' }
  return { minutes: quantile(samples, 0.75), learned: true, n: samples.length, label: `P75 of ${samples.length} complete days` }
}

/** Overcommitment ratio: planned Focus minutes / capacity. >1.25 amber, >1.6 red. */
/**
 * overcommitment function
 * @param {any} plannedFocusMinutes, capacityMinutes
 * @returns {any}
 */
export function overcommitment(plannedFocusMinutes, capacityMinutes) {
  if (!(capacityMinutes > 0)) return { ratio: null, level: 'unknown' }
  const ratio = plannedFocusMinutes / capacityMinutes
  return { ratio, level: ratio > 1.6 ? 'red' : ratio > 1.25 ? 'amber' : 'ok' }
}


