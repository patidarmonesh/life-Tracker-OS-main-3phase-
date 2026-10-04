/**
 * Recurring obligations (plan §9.5–9.6): subscriptions, EMIs, loans.
 * All money is integer minor units (paise). Old data stores rupee numbers; we convert once.
 */
import { toMinorUnits } from '../metrics/finance.js'
import { addDays, assertDate } from '../metrics/dates.js'

/**
 * CYCLES
 * @description Automatically documented.
 */
export const CYCLES = ['weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly']
const CYCLE_ALIASES = { week: 'weekly', weekly: 'weekly', month: 'monthly', monthly: 'monthly', quarter: 'quarterly', quarterly: 'quarterly', 'half-yearly': 'half-yearly', halfyearly: 'half-yearly', 'half yearly': 'half-yearly', semiannual: 'half-yearly', 'semi-annual': 'half-yearly', year: 'yearly', yearly: 'yearly', annual: 'yearly', annually: 'yearly' }
/**
 * normaliseCycle
 * @description Automatically documented.
 */
export const normaliseCycle = cycle => CYCLE_ALIASES[String(cycle || 'monthly').trim().toLowerCase()] || 'monthly'

/** Minor units from either amountMinor or a legacy rupee number/string. */
/**
 * minorOf function
 * @param {any} record, field = 'amount'
 * @returns {any}
 */
export function minorOf(record, field = 'amount') {
  if (Number.isSafeInteger(record?.[`${field}Minor`])) return record[`${field}Minor`]
  const value = record?.[field]
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100)
  return toMinorUnits(value) ?? 0
}

/** weekly × 52/12 · monthly × 1 · quarterly / 3 · half-yearly / 6 · yearly / 12 — fixes old “/12 for everything”. */
/**
 * monthlyEquivalentMinor function
 * @param {any} amountMinor, cycle
 * @returns {any}
 */
export function monthlyEquivalentMinor(amountMinor, cycle) {
  const c = normaliseCycle(cycle)
  const factor = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, 'half-yearly': 1 / 6, yearly: 1 / 12 }[c]
  return Math.round(amountMinor * factor)
}

const monthsIn = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 }
/**
 * addCycle function
 * @param {any} date, cycle, times = 1
 * @returns {any}
 */
export function addCycle(date, cycle, times = 1) {
  assertDate(date)
  const c = normaliseCycle(cycle)
  if (c === 'weekly') return addDays(date, 7 * times)
  const [y, m, d] = date.split('-').map(Number)
  const total = (y * 12 + (m - 1)) + monthsIn[c] * times
  const ny = Math.floor(total / 12), nm = total % 12 + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** Every renewal date of a subscription inside [from, to] (inclusive, YYYY-MM-DD). */
/**
 * occurrencesBetween function
 * @param {any} anchorDate, cycle, from, to
 * @returns {any}
 */
export function occurrencesBetween(anchorDate, cycle, from, to) {
  if (!anchorDate || !/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return []
  let date = anchorDate, guard = 0
  // Walk backwards to the first occurrence on/after `from`.
  while (date > from && guard++ < 600) date = addCycle(date, cycle, -1)
  const result = []
  guard = 0
  while (date <= to && guard++ < 600) { if (date >= from) result.push(date); date = addCycle(date, cycle, 1) }
  return result
}

/**
 * nextOccurrence function
 * @param {any} anchorDate, cycle, today
 * @returns {any}
 */
export function nextOccurrence(anchorDate, cycle, today) {
  if (!anchorDate) return null
  let date = anchorDate, guard = 0
  while (date < today && guard++ < 600) date = addCycle(date, cycle, 1)
  while (guard++ < 1200 && addCycle(date, cycle, -1) >= today) date = addCycle(date, cycle, -1)
  return date
}

/* ── EMI / loan amortisation ─────────────────────────────────────────── */
/** EMI = P·r(1+r)^n / ((1+r)^n − 1), r = annual/12/100; r = 0 → P/n. Returns rupee-precision float in minor units. */
/**
 * emiPayment function
 * @param {any} principalMinor, annualRatePercent, months
 * @returns {any}
 */
export function emiPayment(principalMinor, annualRatePercent, months) {
  const n = Number(months), r = Number(annualRatePercent) / 12 / 100
  if (!(principalMinor > 0) || !(n > 0)) return 0
  if (!r) return principalMinor / n
  const g = (1 + r) ** n
  return principalMinor * r * g / (g - 1)
}
/** Outstanding principal after k payments. */
/**
 * outstandingAfter function
 * @param {any} principalMinor, annualRatePercent, months, paid
 * @returns {any}
 */
export function outstandingAfter(principalMinor, annualRatePercent, months, paid) {
  const r = Number(annualRatePercent) / 12 / 100, emi = emiPayment(principalMinor, annualRatePercent, months), k = Math.min(Number(paid) || 0, months)
  if (!r) return Math.max(0, principalMinor - emi * k)
  const g = (1 + r) ** k
  return Math.max(0, principalMinor * g - emi * (g - 1) / r)
}
/** Legacy EMIs only know the payment and months remaining: outstanding = EMI·(1 − (1+r)^−m)/r. */
/**
 * outstandingFromEmi function
 * @param {any} emiMinor, annualRatePercent, monthsRemaining
 * @returns {any}
 */
export function outstandingFromEmi(emiMinor, annualRatePercent, monthsRemaining) {
  const r = Number(annualRatePercent) / 12 / 100, m = Number(monthsRemaining) || 0
  if (!(emiMinor > 0) || m <= 0) return 0
  return r ? emiMinor * (1 - (1 + r) ** -m) / r : emiMinor * m
}
/**
 * amortisationSchedule function
 * @param {any} principalMinor, annualRatePercent, months
 * @returns {any}
 */
export function amortisationSchedule(principalMinor, annualRatePercent, months) {
  const r = Number(annualRatePercent) / 12 / 100, emi = emiPayment(principalMinor, annualRatePercent, months)
  let balance = principalMinor
  return Array.from({ length: months }, (_, i) => {
    const interest = balance * r, principal = Math.min(balance, emi - interest)
    balance = Math.max(0, balance - principal)
    return { month: i + 1, payment: emi, interest, principal, balance }
  })
}

/** Normalised view of an EMI record (new fields or old {amount, remainingMonths, totalMonths, rate}). */
/**
 * describeEmi function
 * @param {any} emi
 * @returns {any}
 */
export function describeEmi(emi) {
  const rate = Number(emi.rate ?? emi.annualRate ?? 0)
  const total = Number(emi.totalMonths ?? emi.tenureMonths ?? 0) || null
  const remaining = Number(emi.remainingMonths ?? (total != null && emi.paidMonths != null ? total - emi.paidMonths : 0))
  const principal = Number.isSafeInteger(emi.principalMinor) ? emi.principalMinor : emi.principal != null ? minorOf(emi, 'principal') : null
  const payment = principal && total ? Math.round(emiPayment(principal, rate, total)) : minorOf(emi)
  const outstanding = principal && total ? outstandingAfter(principal, rate, total, total - remaining) : outstandingFromEmi(payment, rate, remaining)
  const nextInterest = outstanding * rate / 12 / 100
  return { id: emi.id, name: emi.name || 'EMI', rate, totalMonths: total, remainingMonths: remaining, paymentMinor: payment, outstandingMinor: Math.round(outstanding), nextInterestMinor: Math.round(nextInterest), nextPrincipalMinor: Math.round(Math.max(0, payment - nextInterest)), progress: total ? (total - remaining) / total : null, dueDay: emi.dueDay ?? null, active: remaining > 0 }
}

/**
 * describeSubscription function
 * @param {any} sub, today
 * @returns {any}
 */
export function describeSubscription(sub, today) {
  const amountMinor = minorOf(sub), cycle = normaliseCycle(sub.cycle)
  const next = sub.nextRenewal ? nextOccurrence(sub.nextRenewal, cycle, today) : null
  const daysUntil = next ? Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null
  return { id: sub.id, name: sub.name || 'Subscription', category: sub.category || 'Subscriptions', cycle, amountMinor, monthlyEquivalentMinor: monthlyEquivalentMinor(amountMinor, cycle), yearlyMinor: monthlyEquivalentMinor(amountMinor, cycle) * 12, nextRenewal: next, daysUntil, active: sub.active !== false && !sub.cancelledAt }
}

/**
 * describeLoan function
 * @param {any} loan
 * @returns {any}
 */
export function describeLoan(loan) {
  const direction = /lent|given|gave|receiv/i.test(loan.type || loan.direction || '') ? 'lent' : 'borrowed'
  const amount = minorOf(loan), repaid = Number.isSafeInteger(loan.repaidMinor) ? loan.repaidMinor : 0
  return { id: loan.id, person: loan.person || 'Someone', direction, amountMinor: amount, outstandingMinor: loan.settledAt ? 0 : Math.max(0, amount - repaid), dueDate: loan.dueDate || null, notes: loan.notes || '', settled: Boolean(loan.settledAt) }
}

/** Fixed obligations planned for a month: subscription monthly-eq + active EMIs. */
/**
 * recurringSummary function
 * @param {any} finance = {}, today
 * @returns {any}
 */
export function recurringSummary(finance = {}, today) {
  const subs = (finance.subscriptions || []).map(s => describeSubscription(s, today)).filter(s => s.active)
  const emis = (finance.emis || []).map(describeEmi).filter(e => e.active)
  const loans = (finance.loans || []).map(describeLoan)
  const subsMonthly = subs.reduce((n, s) => n + s.monthlyEquivalentMinor, 0)
  const emiMonthly = emis.reduce((n, e) => n + e.paymentMinor, 0)
  const lent = loans.filter(l => l.direction === 'lent').reduce((n, l) => n + l.outstandingMinor, 0)
  const borrowed = loans.filter(l => l.direction === 'borrowed').reduce((n, l) => n + l.outstandingMinor, 0)
  return { subs, emis, loans, subsMonthlyMinor: subsMonthly, emiMonthlyMinor: emiMonthly, fixedMonthlyMinor: subsMonthly + emiMonthly, debtOutstandingMinor: emis.reduce((n, e) => n + e.outstandingMinor, 0) + borrowed, lentOutstandingMinor: lent, borrowedOutstandingMinor: borrowed, netDebtMinor: borrowed - lent, upcoming: subs.filter(s => s.daysUntil != null && s.daysUntil >= 0 && s.daysUntil <= 7).sort((a, b) => a.daysUntil - b.daysUntil) }
}

/** Savings goal maths: required/month and projected completion from mean of last 3 months’ contributions. */
/**
 * savingsGoalPlan function
 * @param {any} goal, today
 * @returns {any}
 */
export function savingsGoalPlan(goal, today) {
  const target = minorOf(goal, 'target') || minorOf(goal, 'targetAmount'), saved = minorOf(goal, 'saved') || minorOf(goal, 'current') || minorOf(goal, 'currentAmount')
  const remaining = Math.max(0, target - saved)
  const deadline = goal.deadline || goal.targetDate || null
  const monthsLeft = deadline ? Math.max(0, (Number(deadline.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(deadline.slice(5, 7)) - Number(today.slice(5, 7))) : null
  const cutoff = addCycle(today, 'monthly', -3)
  const recent = (goal.transactions || goal.history || []).filter(t => (t.date || '').slice(0, 10) >= cutoff)
  const net = recent.reduce((n, t) => n + (/(withdraw|debit|out)/i.test(t.type || '') ? -1 : 1) * minorOf(t), 0)
  const meanMonthly = recent.length ? net / 3 : null
  const projectedMonths = meanMonthly > 0 ? Math.ceil(remaining / meanMonthly) : null
  const projectedDate = projectedMonths != null ? addCycle(today, 'monthly', projectedMonths) : null
  const requiredMonthly = monthsLeft ? Math.ceil(remaining / Math.max(1, monthsLeft)) : null
  return { targetMinor: target, savedMinor: saved, remainingMinor: remaining, progress: target > 0 ? Math.min(1, saved / target) : null, deadline, monthsLeft, requiredMonthlyMinor: requiredMonthly, meanMonthlyMinor: meanMonthly, projectedDate, onTrack: deadline && projectedDate ? projectedDate <= deadline : null }
}


