import { refreshAccessToken } from './authService.js'

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
export function slotFingerprint(slot) {
  return JSON.stringify([slot.date, slot.start, slot.end, slot.name, slot.category, slot.timezone, slot.reminderMinutes ?? 10, slot.calendarEventKey || slot.id])
}
export async function calendarEventId(id) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id))
  return 'lifeos' + [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}
async function request(path, options = {}) {
  let token = await refreshAccessToken()
  if (!token) throw new Error('Connect Google to sync Calendar.')
  const run = () => fetch(BASE + path, { ...options, signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
  let res = await run()
  if (res.status === 401) {
    token = await refreshAccessToken(true)
    if (!token) throw new Error('Google access expired. Reconnect once in Settings.')
    res = await run()
  }
  if (!res.ok && ![404, 409, 410].includes(res.status)) {
    const data = await res.json().catch(() => ({}))
    throw new Error(res.status === 403 ? 'Enable Google Calendar API and reconnect to grant Calendar permission.' : data.error?.message || 'Calendar sync failed. Will retry.')
  }
  return res
}
function eventDateTime(date, time, timezone) {
  if (time === '24:00') {
    const next = new Date(`${date}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return { dateTime: `${next.toISOString().slice(0, 10)}T00:00:00`, timeZone: timezone }
  }
  return { dateTime: `${date}T${time}:00`, timeZone: timezone }
}
export async function syncPlanSlot(slot) {
  const id = await calendarEventId(slot.calendarEventKey || slot.id)
  const body = {
    summary: slot.name,
    description: `LifeOS tentative plan • ${slot.category}\nAfter this slot, open LifeOS Time Flow to record what actually happened.`,
    start: eventDateTime(slot.date, slot.start, slot.timezone),
    end: eventDateTime(slot.date, slot.end, slot.timezone),
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: Number(slot.reminderMinutes ?? 10) }, { method: 'popup', minutes: 0 }].filter((r, i, all) => all.findIndex(x => x.minutes === r.minutes) === i) },
    extendedProperties: { private: { lifeosPlanSlot: slot.id } },
  }
  let res = await request(`/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  if (res.status === 404) {
    res = await request('', { method: 'POST', body: JSON.stringify({ id, ...body }) })
    if (res.status === 409) res = await request(`/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  }
  if (!res.ok) throw new Error('This Calendar event was removed externally. Duplicate the plan slot to create a new reminder.')
  return res.json()
}
export async function deletePlanEvent(slotId) {
  const res = await request(`/${await calendarEventId(slotId)}`, { method: 'DELETE' })
  if (!res.ok && ![404, 410].includes(res.status)) throw new Error('Could not remove Calendar event.')
}
