import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_PLANNING, approveRevision, checkinActivities, scheduleDraft, zonedInstant } from '../src/domain/planning/index.js'
import { computeDaySync, burnUpSeries, aggregateSync } from '../src/domain/planning/sync.js'
import { shrunkMultiplier, overcommitment } from '../src/domain/planning/learning.js'

const date = '2026-10-04', timezone = 'Asia/Kolkata'
const at = clock => zonedInstant(date, clock, timezone)
const task = (id, minutes, startTime, priority, category = 'Study') => ({ id, taskId: id, title: id, estimateMinutes: minutes, category, priority, fixed: true, startTime })

function fixture() {
  const draft = scheduleDraft([task('study', 90, '09:00', 'must'), task('office', 60, '11:00', 'should', 'Deep Work'), task('gym', 60, '14:00', 'should', 'Exercise')], { localDate: date, timezone, windowStart: '06:00', windowEnd: '22:00', bufferMinutes: 0 })
  const { planning, revision } = approveRevision(structuredClone(EMPTY_PLANNING), { ...draft, localDate: date, timezone }, '2026-10-04T02:00:00Z')
  const [study, office] = revision.blocks
  const timer = { state: 'stopped', segments: [{ startAt: at('09:20'), endAt: at('10:30') }] }
  const studyAnswer = { id: 'c1', blockId: 'study', localDate: date, outcome: 'done', timing: 'timer', answeredAt: at('10:31') }
  const officeAnswer = { id: 'c2', blockId: 'office', localDate: date, outcome: 'partial', timing: 'adjust', startAt: at('11:30'), endAt: at('12:15'), answeredAt: at('12:16') }
  planning.checkins = [studyAnswer, officeAnswer]
  const youtube = { id: 'yt', date, startAt: at('10:30'), endAt: at('11:30'), category: 'Waste Time', description: 'YouTube' }
  const entries = [...checkinActivities(studyAnswer, study, timer), ...checkinActivities(officeAnswer, office), youtube]
  return { planning, timeflow: { entries }, settings: { profile: { timezone } } }
}

test('sync-basic fixture (plan §7.1): 56.7% → 76.7%, effort 61.7%, median delay +25m, drift 30m', () => {
  const sync = computeDaySync(fixture(), date, { now: at('16:00'), timezone })
  assert.equal(Math.round(sync.timing.value * 1000) / 10, 56.7)
  assert.equal(Math.round(sync.timing.upper * 1000) / 10, 76.7)
  assert.equal(Math.round(sync.effort.value * 1000) / 10, 61.7)
  assert.equal(sync.startDelay.median, 25)
  assert.equal(sync.driftInPlanMinutes, 30)
  assert.deepEqual([sync.outcome.done, sync.outcome.committed, sync.outcome.unknown], [1, 3, 1])
  const byId = Object.fromEntries(sync.details.map(d => [d.blockId, d]))
  assert.equal(byId.study.onTimeMinutes, 70); assert.equal(byId.office.onTimeMinutes, 30); assert.equal(byId.office.shiftedMinutes, 15)
  assert.equal(byId.gym.unknownMinutes, 60); assert.equal(byId.study.unknownMinutes, 0)
  assert.equal(byId.office.overrunMinutes, 15)
  assert.equal(byId.study.status, 'late'); assert.equal(byId.gym.status, 'unknown')
  assert.ok(sync.derails.some(d => d.kind === 'drift' && /YouTube/.test(d.text)))
})

test('sync invariants hold for random plans and evidence', () => {
  for (let run = 0; run < 40; run++) {
    const blocks = []
    let cursor = 6 * 60
    for (let i = 0; i < 5; i++) {
      cursor += Math.floor(Math.random() * 60)
      const len = 15 + Math.floor(Math.random() * 120)
      if (cursor + len > 23 * 60) break
      blocks.push(task(`b${i}`, len, `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`, ['must', 'should', 'could'][i % 3]))
      cursor += len
    }
    if (!blocks.length) continue
    const draft = scheduleDraft(blocks, { localDate: date, timezone, windowStart: '00:00', windowEnd: '23:59', bufferMinutes: 0 })
    const { planning, revision } = approveRevision(structuredClone(EMPTY_PLANNING), { ...draft, localDate: date, timezone })
    const entries = revision.blocks.filter(() => Math.random() > 0.3).map((b, i) => {
      const shift = (Math.floor(Math.random() * 90) - 45) * 60000
      return { id: `e${i}`, date, blockId: Math.random() > 0.2 ? b.id : null, category: 'Study', startAt: new Date(Date.parse(b.startAt) + shift).toISOString(), endAt: new Date(Date.parse(b.endAt) + shift + Math.floor(Math.random() * 30) * 60000).toISOString() }
    })
    const sync = computeDaySync({ planning, timeflow: { entries } }, date, { now: at('20:00'), timezone })
    for (const d of sync.details) {
      assert.ok(d.onTimeMinutes >= 0 && d.onTimeMinutes <= d.elapsedPlannedMinutes + 1e-9)
      assert.ok(d.onTimeMinutes + d.shiftedMinutes <= d.elapsedPlannedMinutes + 1e-9)
      assert.ok(Number.isFinite(d.unknownMinutes) && d.unknownMinutes >= 0)
    }
    if (sync.timing.value != null) {
      assert.ok(Number.isFinite(sync.timing.value) && Number.isFinite(sync.timing.upper))
      assert.ok(sync.timing.value <= sync.timing.upper + 1e-9 && sync.timing.upper <= 1)
      assert.ok(sync.effort.value >= sync.timing.value - 1e-9)
    }
  }
})

test('burn-up is monotone and never draws actual in the future', () => {
  const sync = computeDaySync(fixture(), date, { now: at('16:00'), timezone })
  const series = burnUpSeries(sync, { stepMinutes: 15 })
  for (let i = 1; i < series.length; i++) assert.ok(series[i].planned >= series[i - 1].planned)
  assert.ok(series.filter(p => p.future).every(p => p.onPlan === null))
  const last = series.filter(p => !p.future).at(-1)
  assert.equal(last.onPlan, 100) // 70 study + 30 office on-time minutes
})

test('range sync is a ratio of sums, not an average of daily percentages', () => {
  const agg = aggregateSync(fixture(), '2026-10-03', '2026-10-05', { now: at('16:00'), timezone })
  assert.equal(agg.daysWithPlan, 1)
  assert.equal(Math.round(agg.timing.value * 1000) / 10, 56.7)
})

test('a day with no plan reports no-plan instead of 0%', () => {
  const sync = computeDaySync({ planning: EMPTY_PLANNING }, date, { now: at('16:00'), timezone })
  assert.equal(sync.status, 'no-plan'); assert.equal(sync.timing.value, null)
})

test('estimate multiplier shrinks toward 1 and hides below 8 samples', () => {
  assert.equal(shrunkMultiplier([1.5, 1.5, 1.5]).show, false)
  const m = shrunkMultiplier(Array(10).fill(1.3))
  assert.equal(m.show, true); assert.ok(Math.abs(m.multiplier - (10 * 1.3 + 5) / 15) < 1e-9)
  assert.equal(overcommitment(390, 250).level, 'amber'); assert.equal(overcommitment(420, 250).level, 'red')
})
