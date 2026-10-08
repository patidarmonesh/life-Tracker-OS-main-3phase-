import test from 'node:test'
import assert from 'node:assert/strict'
import { monthlyEquivalentMinor, emiPayment, outstandingAfter, outstandingFromEmi, describeEmi, occurrencesBetween, nextOccurrence, savingsGoalPlan } from '../src/domain/finance/recurring.js'
import { monthModel, yearModel, weekdayPattern } from '../src/domain/finance/forecast.js'
import { ledgerRows, compactMoney } from '../src/domain/finance/ledger.js'

const settings = { profile: { currency: 'INR', timezone: 'Asia/Kolkata' }, preferences: { monthlyBudget: 30000 } }
const exp = (id, date, amount, extra = {}) => ({ id, date, amount, category: 'Food', account: 'UPI', ...extra })

test('subscription monthly equivalents for every cycle (weekly ₹99 → ₹429)', () => {
  assert.equal(monthlyEquivalentMinor(9900, 'Weekly'), 42900)
  assert.equal(monthlyEquivalentMinor(30000, 'quarterly'), 10000)
  assert.equal(monthlyEquivalentMinor(60000, 'half-yearly'), 10000)
  assert.equal(monthlyEquivalentMinor(120000, 'Yearly'), 10000)
  assert.equal(monthlyEquivalentMinor(19900, 'Monthly'), 19900)
})

test('EMI ₹5,00,000 @ 10% for 36 months = ₹16,134 (±₹1) and amortises to zero', () => {
  const emi = emiPayment(50000000, 10, 36)
  assert.ok(Math.abs(emi / 100 - 16134) <= 1, String(emi / 100))
  assert.ok(outstandingAfter(50000000, 10, 36, 36) < 1)
  const after12 = outstandingAfter(50000000, 10, 36, 12)
  assert.ok(Math.abs(outstandingFromEmi(emi, 10, 24) - after12) < 1)
  assert.equal(Math.round(emiPayment(120000, 0, 12)), 10000)
  const legacy = describeEmi({ id: 'e', name: 'Bike', amount: 5000, remainingMonths: 10, totalMonths: 24, rate: 12 })
  assert.equal(legacy.paymentMinor, 500000); assert.ok(legacy.outstandingMinor > 4500000 && legacy.outstandingMinor < 5000000)
})

test('renewal dates follow the cycle and clamp month ends', () => {
  assert.deepEqual(occurrencesBetween('2026-01-31', 'monthly', '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-28', '2026-04-28'])
  assert.equal(nextOccurrence('2026-08-15', 'quarterly', '2026-10-04'), '2026-11-15')
  assert.equal(nextOccurrence('2027-01-01', 'monthly', '2026-10-04'), '2026-11-01')
})

test('rent on Oct 1 does not turn Oct 1 red; unknown days stay unfilled', () => {
  const state = { settings, finance: { expenses: [exp('rent', '2026-10-01', 12000, { category: 'Rent' }), exp('f1', '2026-10-01', 300), exp('f2', '2026-10-02', 2500)] } }
  const m = monthModel(state, '2026-10', { today: '2026-10-04' })
  const day = d => m.days.find(x => x.date === d)
  assert.equal(day('2026-10-01').hasFixed, true)
  assert.notEqual(day('2026-10-01').level, 'over')
  assert.equal(day('2026-10-01').fixed, 1200000)
  assert.equal(day('2026-10-03').level, 'unknown')
  assert.equal(day('2026-10-05').level, 'future')
  // B_var = 30,000 − 12,000 fixed = 18,000 → allowance 580.6/day; ₹2,500 is > 1.5× → over.
  assert.equal(m.variableBudgetMinor, 1800000)
  assert.equal(day('2026-10-02').level, 'over')
  // Safe-to-spend today = (18,000 − 2,800) / 28 days remaining incl. today.
  assert.equal(Math.round(m.safeToSpendMinor), Math.round((1800000 - 280000) / 28))
})

test('a month with 3 logged days reports Not enough history', () => {
  const state = { settings, finance: { expenses: [exp('a', '2026-10-01', 100), exp('b', '2026-10-02', 100), exp('c', '2026-10-03', 100)] } }
  assert.equal(monthModel(state, '2026-10', { today: '2026-10-04' }).projection.status, 'not-enough-history')
})

test('projection uses median daily variable spend with a P25–P75 band', () => {
  const expenses = Array.from({ length: 10 }, (_, i) => exp(`e${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`, 100 * (i + 1)))
  const m = monthModel({ settings, finance: { expenses } }, '2026-10', { today: '2026-10-11' })
  assert.equal(m.projection.status, 'projected')
  assert.ok(m.projection.low <= m.projection.value && m.projection.value <= m.projection.high)
  // MTD 5,500 + median 550 × 20 remaining days = 16,500
  assert.equal(m.projection.value, 1650000)
})

test('confirmed no-spend is a green zero, not unknown; SMS-style strings parse exactly', () => {
  const state = { settings, finance: { expenses: [exp('s', '2026-10-02', 'Rs.1,250.00')], noSpendDates: ['2026-10-01'] } }
  const m = monthModel(state, '2026-10', { today: '2026-10-04' })
  assert.equal(m.days[0].level, 'zero'); assert.equal(m.days[1].variable, 125000)
})

test('legacy negative settle rows become income, refunds need originals, duplicates by id collapse', () => {
  const { rows, review } = ledgerRows({ settings, finance: { expenses: [exp('x', '2026-10-01', -500), exp('d', '2026-10-01', 100), exp('d', '2026-10-01', 100), { id: 'r', date: '2026-10-02', amount: 50, type: 'refund', linkedTransactionId: 'missing' }] } })
  assert.equal(rows.find(r => r.id === 'x').type, 'income')
  assert.equal(rows.filter(r => r.id === 'd').length, 1)
  assert.ok(review.some(r => /Refund/.test(r.reason)))
})

test('year model, weekday pattern and compact Indian money labels', () => {
  const state = { settings, finance: { expenses: [exp('a', '2026-01-05', 1000), exp('b', '2026-02-05', 5000), exp('c', '2026-02-06', 1000)] } }
  const y = yearModel(state, 2026, { today: '2026-10-04' })
  assert.equal(y.best.month, '2026-01'); assert.equal(y.worst.month, '2026-02'); assert.equal(y.totalMinor, 700000)
  assert.equal(weekdayPattern(state, '2026-10-04').length, 7)
  assert.equal(compactMoney(120000), '1.2k'); assert.equal(compactMoney(15000000), '1.5L'); assert.equal(compactMoney(52000), '520')
})

test('savings goal required monthly contribution', () => {
  const plan = savingsGoalPlan({ target: 60000, saved: 12000, deadline: '2027-04-01' }, '2026-10-04')
  assert.equal(plan.monthsLeft, 6); assert.equal(plan.requiredMonthlyMinor, 800000)
})
