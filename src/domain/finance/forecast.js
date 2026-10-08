/**
 * Money forecasting & calendar colouring (plan §9.6).
 *
 *   B_var             = monthly budget − fixed obligations planned this month
 *   Safe-to-spend     = max(0, B_var − S_var(before today)) / days remaining incl. today
 *   Day ratio         past: var(day) / (B_var / days in month) · today: var(today) / safe-to-spend
 *   Cell colour       unknown → no fill · confirmed no-spend → ✓ · ≤0.5 low · ≤1 ok · ≤1.5 warn · >1.5 over
 *                     Fixed obligations never colour a day (📌 badge instead).
 *   Projection        MTD_var + median(daily var of logged completed days) × remaining + unpaid fixed,
 *                     band from P25/P75; <5 logged days → last 60 days; still <5 → not enough history.
 */
import { addDays, dateRange, weekday } from '../metrics/dates.js'
import { ledgerRows, spendOf, incomeOf } from './ledger.js'
import { recurringSummary } from './recurring.js'
import { quantile } from '../stats.js'

/**
 * DAY_LEVELS
 * @description Automatically documented.
 */
export const DAY_LEVELS = ['unknown', 'zero', 'low', 'ok', 'warn', 'over']
const median = v => quantile(v, 0.5)
const monthBounds = month => { const [y, m] = month.split('-').map(Number); const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { first: `${month}-01`, last: `${month}-${String(dim).padStart(2, '0')}`, dim } }
/**
 * shiftMonth function
 * @param {any} month, delta
 * @returns {any}
 */
export const shiftMonth = (month, delta) => { const [y, m] = month.split('-').map(Number); const t = y * 12 + m - 1 + delta; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}` }
const isRecurringLinked = r => r.record.emiId || r.record.subscriptionId || r.record.recurringId || (r.record.tags || []).some(t => /^(emi|subscription)$/i.test(t))
/**
 * budgetMinorFor function
 * @param {any} state, month
 * @returns {any}
 */
export const budgetMinorFor = (state, month) => {
  const specific = state.finance?.budgets?.[month]
  const value = specific?.totalMinor ?? (specific?.total != null ? Math.round(Number(specific.total) * 100) : null)
  if (value != null) return value
  const monthly = Number(state.settings?.preferences?.monthlyBudget)
  return monthly > 0 ? Math.round(monthly * 100) : null
}
/**
 * levelFor function
 * @param {any} ratio
 * @returns {any}
 */
export function levelFor(ratio) { return ratio == null ? 'ok' : ratio <= 0.5 ? 'low' : ratio <= 1 ? 'ok' : ratio <= 1.5 ? 'warn' : 'over' }

function groupByDate(rows) {
  const map = new Map()
  for (const row of rows) {
    const day = map.get(row.date) || { variable: 0, fixed: 0, income: 0, count: 0, rows: [] }
    const s = spendOf(row)
    if (row.fixed) day.fixed += s; else day.variable += s
    day.income += incomeOf(row); day.count++; day.rows.push(row)
    map.set(row.date, day)
  }
  return map
}

/**
 * @param {object} state
 * @param {string} month YYYY-MM
 * @param {{today:string, account?:string, currency?:string}} options
 */
/**
 * monthModel function
 * @param {any} state, month, { today, account = 'all', currency } = {}
 * @returns {any}
 */
export function monthModel(state, month, { today, account = 'all', currency } = {}) {
  const cur = currency || state.settings?.profile?.currency || 'INR'
  const { rows: all, review } = ledgerRows(state, { currency: cur })
  const rows = account === 'all' ? all : all.filter(r => r.account === account)
  const byDate = groupByDate(rows)
  const { first, last, dim } = monthBounds(month)
  const dates = dateRange(first, last)
  const noSpend = new Set([...(state.finance?.noSpendDates || []), ...(state.finance?.confirmations || []).filter(c => c.noSpend).map(c => c.date)])
  const recurring = recurringSummary(state.finance, today)
  const monthRows = rows.filter(r => r.date >= first && r.date <= last)
  const fixedUnlinked = monthRows.filter(r => r.fixed && !isRecurringLinked(r)).reduce((n, r) => n + spendOf(r), 0)
  const fixedPlanned = recurring.fixedMonthlyMinor + fixedUnlinked
  const fixedPaid = monthRows.filter(r => r.fixed).reduce((n, r) => n + spendOf(r), 0)
  const budget = budgetMinorFor(state, month)
  const bVar = budget != null ? Math.max(0, budget - fixedPlanned) : null
  const inMonth = today >= first && today <= last, past = today > last
  const varBefore = dates.filter(d => d < today).reduce((n, d) => n + (byDate.get(d)?.variable || 0), 0)
  const remainingInclToday = inMonth ? dim - Number(today.slice(8, 10)) + 1 : 0
  const safeToSpend = inMonth && bVar != null ? Math.max(0, bVar - varBefore) / remainingInclToday : null
  const dailyAllowance = bVar != null ? bVar / dim : null

  const days = dates.map(date => {
    const d = byDate.get(date), future = date > today
    const variable = d?.variable || 0, fixed = d?.fixed || 0, income = d?.income || 0
    const confirmedZero = noSpend.has(date) && !d?.count
    let level = 'unknown', ratio = null
    if (future) level = 'future'
    else if (d?.count && (variable !== 0 || fixed !== 0 || income !== 0)) {
      ratio = date === today ? (safeToSpend > 0 ? variable / safeToSpend : variable > 0 ? Infinity : 0) : dailyAllowance > 0 ? variable / dailyAllowance : null
      level = variable <= 0 ? 'zero' : ratio == null ? 'ok' : levelFor(ratio)
    } else if (confirmedZero) level = 'zero'
    return { date, variable, fixed, income, total: variable + fixed, count: d?.count || 0, rows: d?.rows || [], ratio: Number.isFinite(ratio) ? ratio : ratio === Infinity ? 99 : null, level, confirmedZero, hasFixed: fixed > 0, hasIncome: income > 0, hasBill: (d?.rows || []).some(r => r.record.billId || r.record.billDriveFileId), future }
  })

  const mtdVar = days.filter(d => !d.future).reduce((n, d) => n + d.variable, 0)
  const mtdFixed = days.filter(d => !d.future).reduce((n, d) => n + d.fixed, 0)
  const income = days.reduce((n, d) => n + d.income, 0)
  // Projection: completed, logged days only (a day is logged when it has records or a confirmed no-spend).
  let samples = days.filter(d => d.date < today && (d.count > 0 || d.confirmedZero)).map(d => d.variable)
  let basis = 'this month'
  if (samples.length < 5) {
    samples = dateRange(addDays(today, -60), addDays(today, -1)).filter(d => byDate.has(d) || noSpend.has(d)).map(d => byDate.get(d)?.variable || 0)
    basis = 'last 60 days'
  }
  let projection = null
  if (past) projection = { value: mtdVar + mtdFixed, low: mtdVar + mtdFixed, high: mtdVar + mtdFixed, status: 'actual', basis: 'actual' }
  else if (inMonth && samples.length >= 5) {
    const remaining = dim - Number(today.slice(8, 10)), unpaidFixed = Math.max(0, fixedPlanned - fixedPaid)
    const base = mtdVar + fixedPaid + unpaidFixed
    projection = { value: Math.round(base + median(samples) * remaining), low: Math.round(base + quantile(samples, 0.25) * remaining), high: Math.round(base + quantile(samples, 0.75) * remaining), status: 'projected', basis, sample: samples.length, unpaidFixedMinor: unpaidFixed }
  } else if (inMonth) projection = { value: null, status: 'not-enough-history', basis, sample: samples.length }

  let cumulative = 0
  const pace = days.map((d, i) => { if (!d.future) cumulative += d.variable; return { date: d.date, day: i + 1, actual: d.future ? null : cumulative, ideal: bVar != null ? Math.round(bVar * (i + 1) / dim) : null } })

  // Category breakdown with change vs the mean of the previous 3 months.
  const catTotals = new Map(), accTotals = new Map()
  for (const r of monthRows) { const s = spendOf(r); if (!s) continue; catTotals.set(r.category, (catTotals.get(r.category) || 0) + s); accTotals.set(r.account, (accTotals.get(r.account) || 0) + s) }
  const prevMonths = [1, 2, 3].map(k => monthBounds(shiftMonth(month, -k)))
  const categories = [...catTotals].map(([category, amount]) => {
    const prior = prevMonths.map(b => rows.filter(r => r.category === category && r.date >= b.first && r.date <= b.last).reduce((n, r) => n + spendOf(r), 0))
    const mean = prior.reduce((a, b) => a + b, 0) / 3
    const change = mean > 0 ? (amount - mean) / mean : null
    return { category, amountMinor: amount, previousMeanMinor: Math.round(mean), change, flagged: change != null && Math.abs(change) >= 0.3 && amount >= 50000 }
  }).sort((a, b) => b.amountMinor - a.amountMinor)
  const accounts = [...accTotals].map(([name, amountMinor]) => ({ account: name, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor)

  return {
    month, currency: cur, today, dim, days, budgetMinor: budget, fixedPlannedMinor: fixedPlanned, fixedPaidMinor: fixedPaid, variableBudgetMinor: bVar,
    dailyAllowanceMinor: dailyAllowance, safeToSpendMinor: safeToSpend, mtdVariableMinor: mtdVar, mtdFixedMinor: mtdFixed, mtdTotalMinor: mtdVar + mtdFixed,
    incomeMinor: income, savingsRate: income > 0 ? (income - (mtdVar + mtdFixed)) / income : null,
    utilisation: budget > 0 ? (mtdVar + mtdFixed) / budget : null, remainingMinor: budget != null ? budget - (mtdVar + mtdFixed) : null,
    projection, pace, categories, accounts, recurring, review, accountsAvailable: [...new Set(all.map(r => r.account))].sort(),
    rows: monthRows.sort((a, b) => (b.date + (b.record.createdAt || '')).localeCompare(a.date + (a.record.createdAt || ''))),
  }
}

/** Mean spend per weekday over weeks with ≥5 logged days (last `weeks` weeks). */
/**
 * weekdayPattern function
 * @param {any} state, today, { weeks = 12, currency } = {}
 * @returns {any}
 */
export function weekdayPattern(state, today, { weeks = 12, currency } = {}) {
  const { rows } = ledgerRows(state, { currency: currency || state.settings?.profile?.currency || 'INR' })
  const byDate = groupByDate(rows)
  const noSpend = new Set(state.finance?.noSpendDates || [])
  const sums = Array(7).fill(0), counts = Array(7).fill(0)
  for (let w = 1; w <= weeks; w++) {
    const days = dateRange(addDays(today, -7 * w), addDays(today, -7 * w + 6))
    const logged = days.filter(d => byDate.has(d) || noSpend.has(d))
    if (logged.length < 5) continue
    for (const d of logged) { const wd = (weekday(d) + 6) % 7; sums[wd] += (byDate.get(d)?.variable || 0); counts[wd]++ }
  }
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, meanMinor: counts[i] ? Math.round(sums[i] / counts[i]) : null, samples: counts[i] }))
}

/** Year overview: monthly totals, best/worst month, daily heat map, category stacks. */
/**
 * yearModel function
 * @param {any} state, year, { today, account = 'all', currency } = {}
 * @returns {any}
 */
export function yearModel(state, year, { today, account = 'all', currency } = {}) {
  const cur = currency || state.settings?.profile?.currency || 'INR'
  const { rows: all } = ledgerRows(state, { currency: cur })
  const rows = (account === 'all' ? all : all.filter(r => r.account === account)).filter(r => r.date?.startsWith(String(year)))
  const byDate = groupByDate(rows)
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const mr = rows.filter(r => r.date.startsWith(key))
    const spend = mr.reduce((n, r) => n + spendOf(r), 0), income = mr.reduce((n, r) => n + incomeOf(r), 0)
    const cats = {}
    for (const r of mr) { const s = spendOf(r); if (s) cats[r.category] = (cats[r.category] || 0) + s }
    return { month: key, index: i, spendMinor: spend, incomeMinor: income, count: mr.length, categories: cats, savingsRate: income > 0 ? (income - spend) / income : null, future: today && key > today.slice(0, 7) }
  })
  const withData = months.filter(m => m.count > 0)
  const total = withData.reduce((n, m) => n + m.spendMinor, 0)
  const days = dateRange(`${year}-01-01`, `${year}-12-31`).map(date => ({ date, variable: byDate.get(date)?.variable || 0, fixed: byDate.get(date)?.fixed || 0, count: byDate.get(date)?.count || 0, future: today ? date > today : false }))
  return { year, currency: cur, months, totalMinor: total, averageMonthlyMinor: withData.length ? Math.round(total / withData.length) : null, best: withData.length ? withData.reduce((a, b) => (b.spendMinor < a.spendMinor ? b : a)) : null, worst: withData.length ? withData.reduce((a, b) => (b.spendMinor > a.spendMinor ? b : a)) : null, days, categories: [...new Set(rows.map(r => r.category))] }
}


