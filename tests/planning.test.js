import test from 'node:test'
import assert from 'node:assert/strict'
import { durationMinutes, timeMinutes, validateSlots, summarizeTime, summarizeDay, planComparison } from '../src/utils/planning.js'
import { daysInMonth, dailyBudgetFor, budgetPercent, finiteAmount } from '../src/utils/financeMath.js'
import { calcLifeScore } from '../src/utils/scoreCalculator.js'
import { getTodayDateKey } from '../src/utils/dateTime.js'

test('times validate midnight, adjacency, invalid clocks and overnight ranges', () => {
  assert.equal(durationMinutes('23:00', '24:00'), 60)
  assert.equal(durationMinutes('23:00', '01:00'), 0)
  assert.equal(durationMinutes('09:00', '09:00'), 0)
  assert.ok(Number.isNaN(timeMinutes('10:80')))
  assert.throws(() => validateSlots([{ name: 'A', start: '09:00', end: '10:00' }, { name: 'B', start: '09:59', end: '11:00' }]), /overlaps/)
  assert.equal(validateSlots([{ name: 'A', start: '09:00', end: '10:00' }, { name: 'B', start: '10:00', end: '11:00' }]).length, 2)
})
test('overlapping historical logs count each minute once and waste is never productive', () => {
  const totals = summarizeTime([
    { start: '09:00', end: '11:00', category: 'Study', durationMinutes: 9999 },
    { start: '10:00', end: '11:00', category: 'Social Media', isWaste: false },
    { start: '23:00', end: '24:00', category: 'Sleep' },
  ])
  assert.equal(totals.loggedMins, 180)
  assert.equal(totals.productiveMins, 60)
  assert.equal(totals.wasteMins, 60)
  assert.equal(totals.sleepMins, 60)
  assert.equal(totals.overlapMins, 60)
  assert.equal(totals.unloggedMins + totals.loggedMins, 1440)
})
test('adherence is duration weighted, pending excluded, shifts count only overlap', () => {
  const slots = [{ id: 'a', name: 'Study', start: '09:00', end: '11:00' }, { id: 'b', name: 'Gym', start: '11:00', end: '12:00' }, { id: 'c', name: 'Lunch', start: '12:00', end: '13:00' }]
  const result = planComparison(slots, [{ planSlotId: 'a', start: '09:30', end: '11:00', planOutcome: 'followed' }, { planSlotId: 'b', start: '11:00', end: '12:00', planOutcome: 'missed' }])
  assert.equal(result.followed, 90)
  assert.equal(result.changed, 60)
  assert.equal(result.pending, 90)
  assert.equal(result.adherence, 60)
  assert.equal(planComparison(slots, []).adherence, null)
})
test('legacy overnight logs contribute to both correct calendar days', () => {
  const entries = [{ date: '2026-10-05', start: '23:00', end: '02:00', category: 'Sleep' }]
  assert.equal(summarizeDay(entries, '2026-10-05').sleepMins, 60)
  assert.equal(summarizeDay(entries, '2026-10-06').sleepMins, 120)
  assert.equal(summarizeDay(entries, '2026-10-07').loggedMins, 0)
})
test('finance handles real month lengths, zero budgets, invalid amounts and decimals', () => {
  assert.equal(daysInMonth('2024-02-01'), 29)
  assert.equal(daysInMonth('2026-02-01'), 28)
  assert.equal(dailyBudgetFor(3100, '2026-10-05'), 100)
  assert.equal(dailyBudgetFor(0, '2026-10-05'), 0)
  assert.equal(budgetPercent(0, 0), 0)
  assert.equal(budgetPercent(5, 0), 100)
  assert.equal(finiteAmount(Infinity), 0)
  assert.equal(finiteAmount(0.1 + 0.2), 0.3)
})
test('score stays finite with zero targets, duplicate habit logs and string weights', () => {
  const date = getTodayDateKey('Asia/Kolkata')
  const state = { settings: { profile: { timezone: 'Asia/Kolkata' }, preferences: { monthlyBudget: 0, dailyStudyGoal: 0, scoreWeights: { habits: { weight: '30' } } } }, finance: { expenses: [{ date, amount: 10 }] }, habits: { checkpoints: [{ id: 'a' }, { id: 'b' }], dailyLogs: [{ date, checkpointId: 'a', status: 'done' }, { date, checkpointId: 'a', status: 'done' }] } }
  const result = calcLifeScore(state)
  assert.equal(result.checkpointScore, 50)
  assert.equal(result.financeScore, 0)
  assert.ok(Number.isFinite(result.total))
  assert.ok(result.total >= 0 && result.total <= 100)
})
