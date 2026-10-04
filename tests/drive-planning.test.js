import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mergeDriveModules } from '../src/domain/driveImport.js'
import { parseDiary, scheduleDraft } from '../src/domain/planning/index.js'
import { driveFolders, drivePreview, driveRead } from '../server/drive.js'
import { calendarReminders, exportPlan } from '../server/calendar.js'
import { diaryDraft } from '../server/diary.js'
import { migrateState } from '../src/domain/migration.js'
import { encrypt } from '../server/core.js'

test('old Drive merge preserves records, conflicts, unknown fields and repeats without duplicates', () => {
  const current = { finance: { expenses: [{ id: 'old', amount: 20 }], budgets: { '2026-10': 500 } }, settings: { profile: { timezone: 'Asia/Kolkata' } } }
  const imported = { finance: { expenses: [{ id: 'old', amount: 50 }, { id: 'new', amount: 30 }], legacyNote: 'keep', budgets: { '2026-09': 100 } }, settings: { profile: { timezone: 'UTC', name: 'Mayan' } }, ignored: { injected: true } }
  const first = mergeDriveModules(current, imported)
  assert.equal(first.added, 1); assert.equal(first.conflicts.length, 2)
  assert.equal(first.modules.finance.expenses[0].amount, 20)
  assert.equal(first.modules.finance.legacyNote, 'keep')
  assert.equal(first.modules.settings.profile.name, 'Mayan')
  assert.equal(first.modules.ignored, undefined)
  assert.equal(current.finance.expenses.length, 1)
  const second = mergeDriveModules(first.modules, imported)
  assert.equal(second.added, 0); assert.equal(second.modules.finance.expenses.length, 2)
  assert.equal(second.conflicts[0].imported.amount, 50)
})

test('diary ranges infer duration, support Hinglish and retain ambiguity for review', () => {
  const blocks = parseDiary('09:00–10:30 Study\nshaam 6 se 7 baje walk\n9am to 10am reading\n9 se 10 baje meeting\n23:00-01:00 project')
  assert.deepEqual(blocks.map(b => b.estimateMinutes), [90, 60, 60, 60, 120])
  assert.deepEqual(blocks.map(b => b.startTime), ['09:00', '18:00', '09:00', '09:00', '23:00'])
  assert.equal(blocks[3].periodInferred, true); assert.equal(blocks[4].endsNextDay, true)
  assert.ok(blocks.every(b => b.reminderMinutes === 10))
  const dated = parseDiary('2026-10-04 09:00-10:00 Study')[0]
  assert.equal(dated.startTime, '09:00'); assert.equal(dated.estimateMinutes, 60)
  assert.equal(dated.explicitDate, '2026-10-04')
  const hindi = parseDiary('सुबह ९ से १० बजे पढ़ाई')[0]
  assert.equal(hindi.startTime, '09:00'); assert.equal(hindi.estimateMinutes, 60)
  const plan = scheduleDraft(blocks.slice(0, 2), { localDate: '2026-10-04' })
  assert.equal(plan.blocks.length, 2); assert.equal(plan.blocks[0].endTime, '10:30')
})

function fixture(t, provider, database = () => Response.json([])) {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const request = new URL(url)
    if (request.hostname === 'db.test' && request.pathname.endsWith('/lifeos_connections')) return Response.json([{ scopes: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.app.created', refresh_cipher: 'unused', access_cipher: encrypt('test-token'), expires_at: new Date(Date.now() + 3600000).toISOString(), calendar_id: 'lifeos-calendar' }])
    if (request.hostname === 'db.test' && request.pathname.includes('/rpc/')) return Response.json(true)
    if (request.hostname === 'db.test') return database(request, init)
    return provider(request, init)
  })
  Object.assign(process.env, { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'fixture', TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'), APP_ORIGIN: 'https://lifeos.test', GEMINI_API_KEY: 'fixture' })
}

test('Drive import lists only known modules and rejects files outside the selected folder', async t => {
  const files = [{ id: 'file-finance', name: 'finance.json', size: '80' }, { id: 'file-other', name: 'private.txt' }]
  fixture(t, async (url, init) => {
    assert.equal(init.method || 'GET', 'GET', 'Import must never modify Drive')
    if (url.pathname === '/drive/v3/files') return Response.json({ files })
    assert.equal(url.pathname, '/drive/v3/files/file-finance')
    return Response.json({ expenses: [{ id: 'old', amount: 500 }] })
  })
  assert.equal((await drivePreview('owner', 'folder-123')).files.length, 1)
  await assert.rejects(driveRead('owner', { folderId: 'folder-123', fileIds: ['file-other'] }), /no longer in this folder/)
  const data = await driveRead('owner', { folderId: 'folder-123', fileIds: ['file-finance'] })
  assert.equal(data.ownerId, 'owner'); assert.equal(data.modules.finance.expenses[0].amount, 500)
  assert.equal(data.originals.length, 1)
})

test('Drive lookup escapes folder names and handles pagination', async t => {
  let calls = 0
  fixture(t, async url => {
    assert.ok(url.searchParams.get('q').includes("name='LifeOS\\'s data'"))
    calls++
    return Response.json(calls === 1 ? { files: [{ id: 'first' }], nextPageToken: 'page2' } : { files: [{ id: 'second' }] })
  })
  assert.equal((await driveFolders('owner', "LifeOS's data")).folders.length, 2)
})

test('oversized Drive JSON fails before import', async t => {
  fixture(t, async () => Response.json({ files: [{ id: 'file-big', name: 'journal.json', size: '4000000' }] }))
  await assert.rejects(driveRead('owner', { folderId: 'folder-123', fileIds: ['file-big'] }), /too large/)
})

test('Calendar event gets a ten-minute reminder and a date-specific check-in link', async t => {
  let saved
  fixture(t, async (url, init) => {
    if (init.method === 'POST') { saved = JSON.parse(init.body); return Response.json({ ...saved, etag: 'etag' }) }
    return new Response('', { status: 404 })
  })
  const plan = { id: 'p1', status: 'approved', approvedAt: '2026-10-04T00:00:00Z', revision: 1, localDate: '2026-10-04', timezone: 'Asia/Kolkata', blocks: [{ id: 'b1', title: 'Study', startAt: '2026-10-04T09:00:00+05:30', endAt: '2026-10-04T10:00:00+05:30' }] }
  const result = await exportPlan('owner', plan)
  assert.equal(result.status, 'exported')
  assert.deepEqual(saved.reminders.overrides, [{ method: 'popup', minutes: 10 }])
  assert.match(saved.description, /https:\/\/lifeos.test\/calendar\?date=2026-10-04&block=b1/)
  assert.equal(saved.recurrence, undefined)
  assert.deepEqual(calendarReminders({ reminderMinutes: 0 }), [{ method: 'popup', minutes: 0 }])
})

test('AI diary output remains an unapproved validated draft', async t => {
  fixture(t, async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ tasks: [{ title: 'Study', startTime: '09:00', estimateMinutes: 60, category: 'Study', status: 'approved' }] }) }] } }] }))
  const result = await diaryDraft('owner', { text: '9am-10am study', date: '2026-10-04', timezone: 'Asia/Kolkata' })
  assert.equal(result.tasks[0].status, undefined)
  assert.equal(result.tasks[0].reminderMinutes, 10)
  assert.equal(result.tasks[0].source, 'ai-diary-draft')
})


test('re-importing legacy rows without IDs survives migration and schema differences preserve current data', () => {
  const imported = { timeflow: { entries: [{ date: '2026-10-02', start: '09:00', end: '10:00', category: 'Study' }] } }
  const first = migrateState(mergeDriveModules({}, imported).modules).state
  assert.equal(mergeDriveModules(first, imported).added, 0)
  const conflict = mergeDriveModules({ finance: { budgets: { food: 500 } } }, { finance: { budgets: [] } })
  assert.deepEqual(conflict.modules.finance.budgets, { food: 500 })
  assert.equal(conflict.conflicts.length, 1)
})

for (const externalEdit of [false, true]) test(`removed Calendar blocks respect saved ETags (external edit: ${externalEdit})`, async t => {
  let providerDeletes = 0, mappingDeletes = 0
  fixture(t, async (url, init) => {
    if (init.method === 'DELETE') { providerDeletes++; assert.equal(init.headers['If-Match'], 'original'); return new Response(null, { status: 204 }) }
    return Response.json({ etag: externalEdit ? 'changed' : 'original', extendedProperties: { private: { lifeosOwner: 'owner', lifeosPlan: 'p1' } } })
  }, async (url, init) => {
    if (!url.pathname.endsWith('/lifeos_calendar_exports')) return Response.json([])
    if (init.method === 'DELETE') { mappingDeletes++; return Response.json([]) }
    return Response.json([{ plan_id: 'p1', block_id: 'removed', event_id: 'managed', etag: 'original', revision: 1 }])
  })
  const result = await exportPlan('owner', { id: 'p2', originalRevisionId: 'p1', status: 'approved', approvedAt: '2026-10-04T00:00:00Z', revision: 2, localDate: '2026-10-04', timezone: 'Asia/Kolkata', blocks: [] })
  assert.equal(result.status, externalEdit ? 'partial' : 'exported')
  assert.equal(providerDeletes, externalEdit ? 0 : 1)
  assert.equal(mappingDeletes, externalEdit ? 0 : 1)
})
