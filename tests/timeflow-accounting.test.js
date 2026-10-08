import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeTime, planComparison, dayCutoff } from '../src/utils/planning.js'

test('category and waste remain independent, including waste-flagged sleep', () => {
  const summary = summarizeTime([
    { start: '00:00', end: '02:00', category: 'Talk with Dost', isWaste: true },
    { start: '02:00', end: '09:00', category: 'Sleep', isWaste: true },
    { start: '09:00', end: '11:00', category: 'Study' },
  ])
  assert.deepEqual(summary.categories, { 'Talk with Dost': 120, Sleep: 420, Study: 120 })
  assert.equal(summary.wasteMins, 540)
  assert.equal(summary.productiveMins, 120)
  assert.equal(summary.sleepMins, 420)
  assert.equal(summary.unflaggedSleepMins, 0)
  assert.equal(summary.productiveMins + summary.wasteMins + summary.otherMins, summary.loggedMins)
})

test('elapsed metrics clip crossing entries and use latest edited overlap winner', () => {
  const summary = summarizeTime([
    { start: '00:00', end: '18:00', category: 'Study', updatedAt: '2026-10-08T00:00:00Z' },
    { start: '17:00', end: '17:30', category: 'Meals', updatedAt: '2026-10-08T01:00:00Z' },
  ], 17 * 60 + 15)
  assert.equal(summary.loggedMins, 1035)
  assert.equal(summary.productiveMins, 1020)
  assert.equal(summary.otherMins, 15)
  assert.equal(summary.remainingMins, 405)
  assert.equal(summary.pastUnloggedMins, 0)
  assert.equal(summary.loggedMins + summary.pastUnloggedMins + summary.remainingMins, 1440)
})

test('18:55 with logs through 17:30 gives 85m past gap and 305m remaining', () => {
  const summary = summarizeTime([{ start: '00:00', end: '17:30', category: 'Other' }], 1135)
  assert.equal(summary.pastUnloggedMins, 85)
  assert.equal(summary.remainingMins, 305)
})

test('overrun and multiple actual segments partition plan minutes, upcoming stays pending', () => {
  const plans = [
    { id: 'lunch', category: 'Meals', start: '14:00', end: '14:30' },
    { id: 'study', category: 'Study', start: '14:30', end: '17:00' },
    { id: 'later', category: 'Study', start: '17:00', end: '18:00' },
  ]
  const comparison = planComparison(plans, [
    { category: 'Meals', start: '14:00', end: '14:50', planSlotId: 'lunch' },
    { category: 'Other', start: '14:50', end: '16:30', planSlotId: 'study' },
    { category: 'Study', start: '16:30', end: '17:00', planSlotId: 'study' },
  ], 1020)
  assert.equal(comparison.followed, 60)
  assert.equal(comparison.changed, 120)
  assert.equal(comparison.pending, 60)
  assert.equal(comparison.adherence, 33)
  assert.equal(comparison.planned, comparison.followed + comparison.changed + comparison.pending)
  assert.equal(planComparison(plans, [], 1440).adherence, null)
})

test('future dates, midnight, malformed rows and explicit missed reviews', () => {
  assert.equal(dayCutoff('2026-10-09', '2026-10-08', 1135), 0)
  assert.equal(dayCutoff('2026-10-07', '2026-10-08', 1135), 1440)
  const p = { id: 'p', start: '23:00', end: '24:00', category: 'Sleep', isWaste: true }
  assert.equal(planComparison([p], [p]).adherence, 100)
  const missed = { ...p, planSlotId: 'p', planOutcome: 'missed', ghost: true }
  assert.equal(planComparison([p], [missed]).changed, 60)
  assert.equal(summarizeTime([missed, { start: '99:00', end: '99:59' }]).loggedMins, 0)
})

test('two different waste categories do not count as the same planned activity', () => {
  const result = planComparison([{ id: 'social', category: 'Social Media', start: '09:00', end: '10:00' }], [
    { category: 'Entertainment', start: '09:00', end: '10:00', planSlotId: 'social', isWaste: true },
  ])
  assert.equal(result.adherence, 0)
  assert.equal(result.changed, 60)
})
