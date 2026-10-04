/**
 * Row-level ledger used by Money pages (calendar cells, category/account breakdowns, forecasts).
 * Mirrors ledgerSummary() rules in ../metrics/finance.js: confirmed records only, integer minor
 * units, identity/reference dedupe, refunds only against a confirmed original, transfers excluded.
 */
import { toMinorUnits } from '../metrics/finance.js'

const SPEND_TYPES = new Set(['expense', 'debit', 'fee'])
const SUPPORTED = new Set(['expense', 'debit', 'fee', 'refund', 'income', 'credit', 'transfer', 'own-transfer', 'investment'])
const FIXED_CATEGORY = /\b(rent|emi|loan|insurance|bills? ?utilities|electricity|maintenance|school fee|tuition)\b/i

/**
 * isFixedRecord function
 * @param {any} r
 * @returns {any}
 */
export function isFixedRecord(r) {
  if (r.fixed === true || r.isFixed === true || r.kind === 'fixed' || r.recurringId || r.subscriptionId || r.emiId) return true
  if (r.fixed === false || r.isFixed === false) return false
  return (r.tags || []).some(t => /^(emi|rent|fixed)$/i.test(t)) || FIXED_CATEGORY.test(r.category || '')
}

/**
 * @returns {{ rows: Array, review: Array }} rows: { id, date, amountMinor (signed spend contribution for refunds), type, currency, category, account, merchant, fixed, record }
 */
/**
 * ledgerRows function
 * @param {any} state, { currency: wanted } = {}
 * @returns {any}
 */
export function ledgerRows(state, { currency: wanted } = {}) {
  const base = state.settings?.profile?.currency || 'INR'
  const records = [...(state.finance?.expenses || []), ...(state.finance?.transactions || [])]
  const review = [], byKey = new Map(), byId = new Map()
  records.forEach((r, i) => {
    if (r.deletedAt || ['failed', 'pending', 'proposed', 'rejected'].includes(r.status) || r.confirmed === false) return
    const currency = r.currency || base
    let amount = Number.isSafeInteger(r.amountMinor) ? r.amountMinor : toMinorUnits(r.amount, ['JPY', 'KRW'].includes(currency) ? 0 : 2)
    if (amount == null && typeof r.amount === 'number' && Number.isFinite(r.amount)) amount = Math.round(r.amount * 100)
    let type = r.type || r.transactionType || 'expense'
    // Legacy negative “settle” rows were money received back; treat as income, not negative spend.
    if (amount != null && amount < 0) { amount = -amount; if (type === 'expense') type = 'income' }
    if (amount == null) { review.push({ record: r, reason: 'Invalid amount' }); return }
    if (!SUPPORTED.has(type)) { review.push({ record: r, reason: 'Unknown transaction type' }); return }
    const reference = r.reference || r.transactionRef || r.upiRef
    const key = reference ? JSON.stringify([currency, r.provider || r.bankId || '', r.accountId || r.account || '', reference]) : `id:${r.id ?? `idx${i}`}`
    const row = { id: r.id ?? `idx${i}`, date: r.date || r.localDate, amountMinor: amount, type, currency, category: r.category || 'Miscellaneous', account: r.account || r.paymentMethod || 'Unassigned', merchant: r.merchant || r.title || r.note || r.description || '', fixed: isFixedRecord(r), record: r }
    const prior = byKey.get(key)
    if (prior) {
      if (prior.amountMinor !== row.amountMinor || prior.type !== row.type || prior.date !== row.date) { prior.conflict = true; review.push({ record: r, reason: 'Same transaction identity has conflicting details' }) }
      if (r.id) byId.set(r.id, prior)
      return
    }
    byKey.set(key, row)
    if (r.id) byId.set(r.id, row)
  })
  const accepted = [...byKey.values()].filter(r => !r.conflict && r.date && (!wanted || r.currency === wanted))
  const refunded = new Map()
  const rows = []
  for (const row of accepted) {
    if (row.type === 'refund') {
      const original = byId.get(row.record.linkedTransactionId)
      const total = (refunded.get(original) || 0) + row.amountMinor
      if (!original || !SPEND_TYPES.has(original.type) || original.currency !== row.currency || original.date > row.date || total > original.amountMinor) { review.push({ record: row.record, reason: 'Refund needs a confirmed original expense' }); continue }
      refunded.set(original, total)
      rows.push({ ...row, category: original.category, account: original.account, fixed: original.fixed })
      continue
    }
    rows.push(row)
  }
  return { rows, review }
}

/** Signed spend contribution: expenses/fees +, refunds −, everything else 0. */
export const spendOf = row => SPEND_TYPES.has(row.type) ? row.amountMinor : row.type === 'refund' ? -row.amountMinor : 0
/**
 * incomeOf
 * @description Automatically documented.
 */
export const incomeOf = row => ['income', 'credit'].includes(row.type) ? row.amountMinor : 0

/**
 * compactMoney function
 * @param {any} minor, currency = 'INR'
 * @returns {any}
 */
export function compactMoney(minor, currency = 'INR') {
  const value = Math.abs(minor) / (['JPY', 'KRW'].includes(currency) ? 1 : 100)
  const sign = minor < 0 ? '−' : ''
  if (currency === 'INR') {
    if (value >= 1e7) return `${sign}${(value / 1e7).toFixed(value >= 1e8 ? 0 : 1)}Cr`
    if (value >= 1e5) return `${sign}${(value / 1e5).toFixed(value >= 1e6 ? 0 : 1)}L`
  }
  if (value >= 1e3) return `${sign}${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k`
  return `${sign}${Math.round(value)}`
}

/**
 * formatMoney function
 * @param {any} minor, currency = 'INR', { decimals } = {}
 * @returns {any}
 */
export function formatMoney(minor, currency = 'INR', { decimals } = {}) {
  if (minor == null || !Number.isFinite(minor)) return '—'
  const major = minor / (['JPY', 'KRW'].includes(currency) ? 1 : 100)
  const d = decimals ?? (Number.isInteger(major) || Math.abs(major) >= 1000 ? 0 : 2)
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(major)
}


