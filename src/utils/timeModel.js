// timeModel.js — reference implementation (pure functions, no React)
export const tm = (v) => (v === '24:00' ? 1440 : (([h, m]) => h * 60 + m)(v.split(':').map(Number)))
export const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// 1. category → group (what counts as "the same activity") and kind (how it is scored)
export const DEFAULT_GROUP = { 'Morning Routine': 'selfcare', 'Self-Care': 'selfcare', 'Waste Time': 'waste', 'Social Media': 'waste', 'Entertainment': 'waste', 'Waste in Lab': 'waste' }
export const DEFAULT_KIND = {  // level 0..4 like RescueTime's pulse
  Study: { kind: 'focus', level: 4 }, 'Deep Work': { kind: 'focus', level: 4 }, Class: { kind: 'focus', level: 4 },
  Exercise: { kind: 'productive', level: 3 }, 'Talk with Dost': { kind: 'social', level: 2 },
  Sleep: { kind: 'rest', level: null }, Meals: { kind: 'maintenance', level: null },
  'Self-Care': { kind: 'maintenance', level: null }, 'Morning Routine': { kind: 'maintenance', level: null },
  'Waste Time': { kind: 'waste', level: 0 }, 'Waste in Lab': { kind: 'waste', level: 0 },
  'Social Media': { kind: 'waste', level: 0 }, Entertainment: { kind: 'waste', level: 0 },
}
export const groupOf = (c, map = DEFAULT_GROUP) => map[c] || c
export const kindOf = (c, map = DEFAULT_KIND) => map[c] || (/waste|time\s?pass|scroll/i.test(c || '') ? { kind: 'waste', level: 0 } : { kind: 'neutral', level: 2 })

// 2. one minute-by-minute truth (latest edited wins, conflicts remembered)
export function resolveMinutes(entries) {
  const mins = new Array(1440).fill(null), conflict = new Array(1440).fill(false)
  const sorted = [...entries].sort((a, b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')))
  for (const e of sorted) { 
    if (e.ghost || e.planOutcome === 'missed') continue // Skip AI ghost entries
    const s = tm(e.start), en = tm(e.end); 
    if (!(en > s)) continue; 
    for (let i = s; i < en; i++) { 
      if (mins[i]) conflict[i] = true; 
      mins[i] = e 
    } 
  }
  return { mins, conflict }
}
export const runsOf = (mins, pred) => { 
  const out = []; let cur = null
  for (let i = 0; i < 1440; i++) { 
    const hit = mins[i] && pred(mins[i]); 
    if (hit && !cur) cur = { start: i, end: i + 1, entry: mins[i] }; 
    else if (hit) cur.end = i + 1; 
    else if (cur) { out.push(cur); cur = null } 
  }
  if (cur) out.push(cur); 
  return out 
}

// 3. reconcile plan vs actual
export function reconcile({ plans = [], entries = [], nowMin = 1440, grace = 5, maxShift = 480, kinds = DEFAULT_KIND, groups = DEFAULT_GROUP, minLogCoverage = 0.5 }) {
  const { mins, conflict } = resolveMinutes(entries)
  const G = (c) => groupOf(c, groups)
  const sortedPlans = [...plans].sort((a, b) => tm(a.start) - tm(b.start))
  const ov = (r, s, e) => Math.max(0, Math.min(e, r.end) - Math.max(s, r.start))

  // PASS 1 — which actual run "belongs" to which plan slot (overlap first, then the user's own link)
  const runsByGroup = {}; const owner = new Map()            // run.start+group -> slot id
  const runsFor = (g) => (runsByGroup[g] ||= runsOf(mins, (a) => G(a.category) === g))
  const pick = new Map()                                      // slot id -> run
  const claim = (slot, run, g) => { pick.set(slot.id, run); const k = g + run.start; const prev = owner.get(k); if (!prev || ov(run, tm(slot.start), tm(slot.end)) > ov(run, tm(prev.start), tm(prev.end))) owner.set(k, slot) }
  sortedPlans.forEach((p) => {
    const g = G(p.category), s = tm(p.start), e = tm(p.end), runs = runsFor(g)
    const best = [...runs].sort((x, y) => ov(y, s, e) - ov(x, s, e))[0]
    if (best && ov(best, s, e) > 0) return claim(p, best, g)
    const i = mins.findIndex((a) => a && a.planSlotId === p.id && G(a.category) === g)
    const lr = i >= 0 && runs.find((r) => i >= r.start && i < r.end)
    if (lr) claim(p, lr, g)
  })
  
  // PASS 2 — slots still without a run may take the nearest UNCLAIMED run of the same activity (= "done at another time")
  sortedPlans.forEach((p) => {
    if (pick.has(p.id)) return
    const g = G(p.category), s = tm(p.start)
    const free = runsFor(g).filter((r) => !owner.has(g + r.start) && Math.abs(r.start - s) <= maxShift)
      .sort((x, y) => Math.abs(x.start - s) - Math.abs(y.start - s))[0]
    if (free) claim(p, free, g)
  })

  // PASS 3 — minute accounting + flags per slot
  const slots = sortedPlans.map((p) => {
    const s = tm(p.start), e = tm(p.end), L = Math.max(0, e - s), g = G(p.category), run = pick.get(p.id) || null
    let on = 0, unl = 0, fut = 0; const subs = new Map()
    for (let i = s; i < e; i++) {
      const a = mins[i]
      if (!a) { i >= nowMin ? fut++ : unl++; continue }
      if (G(a.category) === g) on++
      else { const k = subs.get(a.id) || { id: a.id, name: a.name, category: a.category, min: 0 }; k.min++; subs.set(a.id, k) }
    }
    const pastL = L - fut, runLen = run ? run.end - run.start : 0, sd = run ? run.start - s : null, ed = run ? run.end - e : null
    const subMin = [...subs.values()].reduce((a, b) => a + b.min, 0), kind = kindOf(p.category, kinds).kind, flags = []
    
    if (pastL <= 0) flags.push('UPCOMING')
    else {
      if (s <= nowMin && e > nowMin) flags.push('IN_PROGRESS')
      if (on === 0 && run) flags.push('SHIFTED')                      // done, but in another window
      if (on > 0 && sd > grace) flags.push('LATE_START')
      if (on > 0 && sd < -grace) flags.push('EARLY_START')
      if (on > 0 && ed > grace) flags.push('OVERRAN')
      if (on > 0 && ed < -grace && run.end < nowMin) flags.push('CUT_SHORT')
      if (subMin >= pastL * 0.5) flags.push('SUBSTITUTED')
      if (unl >= pastL * 0.5) flags.push('UNLOGGED')
      if (!flags.some((f) => f !== 'IN_PROGRESS')) flags.push('ON_TIME')
      if (kind === 'waste' || /unclear/i.test(p.name)) flags.push('PLANNED_WASTE')
    }
    const fidelity = pastL <= 0 ? null : on > 0 ? Math.round((on / (L + (runLen - on))) * 100) : 0
    return { id: p.id, name: p.name, category: p.category, start: p.start, end: p.end, kind, minutes: L, lived: pastL, on, unl, fut,
      subs: [...subs.values()].sort((a, b) => b.min - a.min), run: run && { start: hhmm(run.start), end: hhmm(run.end) },
      startDelta: sd, endDelta: ed, fidelity, flags: Array.from(new Set(flags)), countsInAdherence: kind !== 'waste' && pastL > 0, causes: [] }
  })
  
  // WHY: who stole my slot?
  const byId = Object.fromEntries(slots.map((x) => [x.id, x]))
  slots.forEach((x) => x.subs.forEach((sb) => {
    const idx = mins.findIndex((a) => a && a.id === sb.id); const run = runsFor(G(sb.category)).find((r) => idx >= r.start && idx < r.end)
    const o = run && owner.get(G(sb.category) + run.start)
    if (o && o.id !== x.id) x.causes.push({ slotId: o.id, name: o.name, min: sb.min, type: tm(o.start) < tm(x.start) ? 'DELAY_CASCADE' : 'PULLED_FORWARD' })
  }))
  const rootOf = (id, seen = new Set()) => { const c = byId[id]?.causes.filter((k) => k.type === 'DELAY_CASCADE').sort((a, b) => b.min - a.min)[0]; return c && !seen.has(c.slotId) ? rootOf(c.slotId, seen.add(id)) : id }
  slots.forEach((x) => { x.root = x.causes.some((k) => k.type === 'DELAY_CASCADE') ? rootOf(x.id) : null })

  const counted = slots.filter((x) => x.countsInAdherence && !x.flags.includes('PLANNED_WASTE'))
  const lived = counted.reduce((a, x) => a + x.lived, 0), onSum = counted.reduce((a, x) => a + x.on, 0)
  
  const byGroup = {}
  slots.forEach((x) => { (byGroup[G(x.category)] ||= { planned: 0, actual: 0 }).planned += x.lived })
  mins.forEach((a, i) => { if (a && i < nowMin) (byGroup[G(a.category)] ||= { planned: 0, actual: 0 }).actual++ })
  const focus = Object.entries(byGroup).filter(([g]) => kindOf(g, kinds).kind === 'focus')
  const fp = focus.reduce((a, [, v]) => a + v.planned, 0), fd = focus.reduce((a, [, v]) => a + Math.min(v.planned, v.actual), 0)
  let pm = 0, pw = 0; mins.forEach((a, i) => { if (!a || i >= nowMin) return; const lv = kindOf(a.category, kinds).level; if (lv == null) return; pm++; pw += lv })
  
  const gaps = runsOf(mins.map((a, i) => (a ? null : { i })), () => true).filter((r) => r.start < nowMin).map((r) => ({ start: hhmm(r.start), end: hhmm(Math.min(r.end, nowMin)), min: Math.min(r.end, nowMin) - r.start }))
  
  // Calculate total awake lived time (ignoring sleep)
  let awakeLived = 0, loggedAwakeLived = 0
  const sleepG = G('Sleep')
  for (let i = 0; i < nowMin; i++) {
    const isSleep = mins[i] && G(mins[i].category) === sleepG
    if (!isSleep) awakeLived++
    if (mins[i] && !isSleep) loggedAwakeLived++
  }
  
  const logCoverage = awakeLived > 0 ? loggedAwakeLived / awakeLived : 1
  const hasEnoughLogs = logCoverage >= minLogCoverage
  
  return { 
    slots, byGroup, gaps, conflictMins: conflict.filter(Boolean).length,
    adherence: (lived && hasEnoughLogs) ? Math.round((onSum / lived) * 100) : null, 
    completionFocus: fp ? Math.round((fd / fp) * 100) : null,
    pulse: pm ? Math.round((pw / (4 * pm)) * 100) : null, 
    discretionaryMin: pm,
    hasEnoughLogs,
    logCoverage
  }
}
