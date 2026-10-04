import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarEventId, slotFingerprint, syncPlanSlot, deletePlanEvent } from '../src/services/calendarService.js'

const store = new Map([['lifeos_google_session', JSON.stringify({ accessToken: 'test-only', tokenExpiresAt: Date.now() + 3600000 })]])
globalThis.localStorage = { getItem: key => store.get(key) || null }
const slot = { id: 'plan-1', date: '2026-10-05', start: '23:00', end: '24:00', name: 'Read', category: 'Other', timezone: 'Asia/Kolkata', reminderMinutes: 10 }
test('Calendar event ID is stable and valid base32hex; edits change fingerprints only', async () => {
  assert.equal(await calendarEventId(slot.id), await calendarEventId(slot.id))
  assert.match(await calendarEventId(slot.id), /^[a-v0-9]{5,1024}$/)
  assert.notEqual(slotFingerprint(slot), slotFingerprint({ ...slot, start: '22:00' }))
})
test('Calendar retries safely after duplicate insert and handles midnight in user timezone', async t => {
  const methods = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    methods.push(options.method)
    const body = JSON.parse(options.body)
    assert.equal(body.end.dateTime, '2026-10-06T00:00:00')
    assert.equal(body.end.timeZone, 'Asia/Kolkata')
    assert.deepEqual(body.reminders.overrides.map(r => r.minutes), [10, 0])
    if (methods.length === 1) return Response.json({}, { status: 404 })
    if (methods.length === 2) return Response.json({}, { status: 409 })
    return Response.json({ id: 'existing', htmlLink: 'https://calendar.google.com/test' })
  })
  const result = await syncPlanSlot(slot)
  assert.equal(result.id, 'existing')
  assert.deepEqual(methods, ['PATCH', 'POST', 'PATCH'])
})
test('deletion is idempotent and permission failures stay actionable', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 410 }))
  await deletePlanEvent(slot.id)
  globalThis.fetch = async () => Response.json({}, { status: 403 })
  await assert.rejects(syncPlanSlot(slot), /Calendar API/)
})
