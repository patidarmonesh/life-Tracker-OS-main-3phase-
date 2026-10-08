import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDiary, resolveAmbiguity } from '../src/domain/planning/parser.js'

const one = text => parseDiary(text)[0]
const cases = [
  ['9 se 11 GATE thermo must', '09:00', 120, { priority: 'must', category: 'Study' }],
  ['shaam 6 se 7 baje walk', '18:00', 60, { category: 'Exercise' }],
  ['subah 6:30 uthna', '06:30', 30, { estimateAssumed: true }],
  ['dopahar 2 se 4 project', '14:00', 120],
  ['saade 9 se 11 tak padhai', '09:30', 90, { category: 'Study' }],
  ['sava 10 meeting 45 min', '10:15', 45],
  ['paune 8 nashta', '07:45', 30, { category: 'Meals' }],
  ['raat 11 se 1 movie', '23:00', 120, { endsNextDay: true }],
  ['२ से ४ बजे पढ़ाई', '14:00', 120, { category: 'Study' }],
  ['lunch 1-1:45', '13:00', 45, { category: 'Meals' }],
  ['11:30-1 office standup + emails', '11:30', 90, { category: 'Deep Work' }],
  ['09:00 पढ़ाई 1 घंटे', '09:00', 60],
]
for (const [input, start, minutes, extra = {}] of cases) {
  test(`Hinglish parser: ${input}`, () => {
    const t = one(input)
    assert.equal(t.warning, '', t.warning)
    assert.equal(t.startTime, start); assert.equal(t.estimateMinutes, minutes)
    for (const [k, v] of Object.entries(extra)) assert.equal(t[k], v, k)
  })
}

test('"7 baje call" is ambiguous inside the waking window and offers both options', () => {
  const t = one('7 baje call')
  assert.match(t.warning, /AM\/PM/)
  assert.deepEqual(t.ambiguity.options.map(o => o.startTime), ['07:00', '19:00'])
  const fixed = resolveAmbiguity(t, t.ambiguity.options[1])
  assert.equal(fixed.startTime, '19:00'); assert.equal(fixed.warning, ''); assert.equal(fixed.fixed, true)
})

test('diary order resolves later bare hours and comma-separated tasks split', () => {
  const tasks = parseDiary('subah 6:30 uthna, 7-8 gym\n9 se 11 study\n7 baje call mummy')
  assert.equal(tasks.length, 4)
  assert.deepEqual(tasks.map(t => t.startTime), ['06:30', '07:00', '09:00', '19:00'])
  assert.equal(tasks[1].periodInferred, true)
})

test('titles are cleaned of time words but keep the task', () => {
  assert.equal(one('9 se 11 GATE thermo must').title, 'GATE thermo')
  assert.equal(one('- shaam 6 se 7 baje walk with Tina').title, 'walk with Tina')
})

test('custom waking window changes resolution', () => {
  // A night-owl window (11:00 → 03:00) makes "2 se 4" an early-morning block.
  assert.equal(parseDiary('2 se 4 coding', { wakeTime: '11:00', sleepTime: '05:00' })[0].warning !== '', true)
  assert.equal(parseDiary('9 se 10 reading', { wakeTime: '10:00', sleepTime: '23:30' })[0].startTime, '21:00')
})
