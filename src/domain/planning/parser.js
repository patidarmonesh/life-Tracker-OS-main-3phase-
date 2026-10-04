/**
 * Diary → plan tasks. Deterministic Hinglish / Hindi / English parser (plan §6.3, §20.3).
 *
 * Bare hours ("9 se 11", "7 baje") are resolved with the waking-window rule: keep only the AM/PM
 * readings whose whole interval fits inside the user's wake–sleep window. If more than one fits,
 * earlier diary lines give sequence context (a diary is written in order); if there is still no
 * single answer, the task carries a warning with both options so the UI can resolve it in one tap.
 */
const uid = (prefix = 'record') => `${prefix}_${globalThis.crypto.randomUUID()}`
const pad = n => String(n).padStart(2, '0')
/**
 * minuteClock
 * @description Automatically documented.
 */
export const minuteClock = minutes => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`
const clockToMinutes = clock => { const m = /^(\d{1,2}):(\d{2})$/.exec(clock || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const label12 = minutes => { const h = Math.floor(minutes / 60) % 24, m = minutes % 60; return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}` }

const DEVANAGARI = '०१२३४५६७८९'
const MORNING = /\b(subah|subha|savere|morning|am)\b|सुबह|सवेरे/i
const AFTERNOON = /\b(dopahar|dopehar|dupahar|afternoon|noon)\b|दोपहर/i
const EVENING = /\b(shaam|sham|evening)\b|शाम/i
const NIGHT = /\b(raat|rat|night|tonight)\b|रात/i
// Semantic hints help when only the activity says when it happens ("paune 8 nashta").
const HINT_AM = /\b(nashta|breakfast|uth(na|ega|unga|o)?|wake|jog(ging)?|morning walk)\b|नाश्ता|उठना/i
const HINT_NOON = /\b(lunch)\b|लंच/i
const HINT_PM = /\b(dinner|sona|sleep|bed)\b|डिनर|सोना/i

/**
 * CATEGORY_RULES
 * @description Automatically documented.
 */
export const CATEGORY_RULES = [
  ['Study', /\b(study|studies|padh(ai|na|unga)?|read(ing)?|gate|revision|revise|lecture|course|notes|thermo|maths?|physics|chem(istry)?|exam|practice|mock|dsa|leetcode)\b|पढ़|पढाई|पढ़ाई/i],
  ['Exercise', /\b(gym|walk|run(ning)?|jog(ging)?|yoga|exercise|workout|swim|cycle|cycling|stretch|sport|cricket|football|badminton)\b|व्यायाम|चलना|योग/i],
  ['Meals', /\b(lunch|dinner|breakfast|nashta|khana|meal|eat|snack|chai)\b|खाना|नाश्ता/i],
  ['Sleep', /\b(sleep|sona|nap|bed)\b|सोना|नींद/i],
  ['Morning Routine', /\b(uth(na)?|wake|bath|nahana|brush|ready|freshen)\b|उठना|नहाना/i],
  ['Travel', /\b(travel|commute|metro|bus|drive|cab|train|flight|office jana)\b/i],
  ['Entertainment', /\b(movie|netflix|series|game|gaming|youtube|music|show)\b/i],
  ['Self-Care', /\b(meditat(e|ion)|journal|skincare|therapy|self[- ]care|rest)\b|ध्यान/i],
  ['Deep Work', /\b(office|work|project|meeting|standup|stand-up|email|emails|code|coding|client|call|review|design|report)\b/i],
]
/**
 * guessCategory function
 * @param {any} text
 * @returns {any}
 */
export function guessCategory(text) { return CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] || 'Deep Work' }

/** Normalise Hindi words for quarter/half hours and Devanagari digits into clock tokens. */
/**
 * normaliseDiaryLine function
 * @param {any} raw
 * @returns {any}
 */
export function normaliseDiaryLine(raw) {
  let line = String(raw).replace(/[०-९]/g, d => String(DEVANAGARI.indexOf(d)))
  line = line.replace(/^(?:[\s\-*•·>~–—✅🔹🔸👉\u2022\u25CF\u25E6\u2023\u2043]|☑️|✔️|▪️|▫️|⭐️|➡️)+/u, '')
  line = line.replace(/\b(saade|sade|saadhe)\s+(\d{1,2})\b|साढ़े\s*(\d{1,2})/gi, (_, _w, h, h2) => `${Number(h ?? h2)}:30`)
  line = line.replace(/\b(sava|sawa)\s+(\d{1,2})\b|सवा\s*(\d{1,2})/gi, (_, _w, h, h2) => `${Number(h ?? h2)}:15`)
  line = line.replace(/\b(paune|pone)\s+(\d{1,2})\b|पौने\s*(\d{1,2})/gi, (_, _w, h, h2) => { const hour = Number(h ?? h2); return `${hour === 1 ? 12 : hour - 1}:45` })
  line = line.replace(/\bdhai\b|ढाई/gi, '2:30').replace(/\bderh\b|डेढ़/gi, '1:30')
  line = line.replace(/\bhalf past\s+(\d{1,2})\b/gi, (_, h) => `${h}:30`).replace(/\bquarter past\s+(\d{1,2})\b/gi, (_, h) => `${h}:15`)
  return line
}

/** Split one physical line into several tasks when commas separate time-led phrases. */
/**
 * splitDiary function
 * @param {any} text
 * @returns {any}
 */
export function splitDiary(text) {
  return String(text).split(/\n|;/).map(l => l.trim()).filter(Boolean)
    .flatMap(line => line.split(/,(?=\s*(?:\d|saade|sade|sava|sawa|paune|subah|shaam|sham|raat|dopahar|[०-९]))/i).map(s => s.trim()).filter(Boolean))
}

const TOKEN = String.raw`(\d{1,2})(?::([0-5]\d))?(?:\s*(am|pm|a\.m\.|p\.m\.)(?![a-z]))?`
const RANGE = new RegExp(String.raw`(?:^|[^\d:])${TOKEN}\s*(?:baje|बजे|bje)?\s*(?:[-–—]|\bto\b|\bse\b|से|\btill\b|\buntil\b)\s*${TOKEN}(?![\d:])`, 'i')
const POINT_COLON = /(?:^|[^\d:])(\d{1,2}):([0-5]\d)\s*(am|pm)?(?![\d:])/i
const POINT_AMPM = /(?:^|[^\d:])(\d{1,2})\s*(am|pm)\b/i
const POINT_BAJE = /(?:^|[^\d:])(\d{1,2})\s*(?:baje|बजे|bje)\b/i
const DURATION = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|घंटे?|घंटा|ghante?|ghanta|minutes?|mins?|m|मिनट)(?=\s|$|[,.;)])/i

/** Candidate minute-of-day readings for a token. */
function readings({ hour, minute, period, raw }, context) {
  if (hour > 23 || minute > 59) return []
  const p = (period || '').replace(/\./g, '').toLowerCase()
  if (p) { if (hour < 1 || hour > 12) return []; return [(hour % 12 + (p === 'pm' ? 12 : 0)) * 60 + minute] }
  if (hour >= 13 || hour === 0 || /^0\d/.test(raw)) return [hour * 60 + minute] // explicit 24-hour
  if (context === 'am') return [(hour % 12) * 60 + minute]
  if (context === 'noon') return [(hour === 12 ? 12 : hour < 6 ? hour + 12 : hour) * 60 + minute]
  if (context === 'pm') return [(hour % 12 + 12) * 60 + minute]
  if (context === 'night') return [(hour === 12 || hour <= 4 ? hour % 12 : hour % 12 + 12) * 60 + minute]
  return [...new Set([(hour % 12) * 60 + minute, (hour % 12 + 12) * 60 + minute])]
}

function contextOf(line) {
  if (MORNING.test(line)) return 'am'
  if (AFTERNOON.test(line)) return 'noon'
  if (EVENING.test(line)) return 'pm'
  if (NIGHT.test(line)) return 'night'
  if (HINT_AM.test(line)) return 'am'
  if (HINT_NOON.test(line)) return 'noon'
  if (HINT_PM.test(line)) return 'pm'
  return ''
}

/** Does [start, start+duration) sit inside the waking window (which may itself wrap midnight)? */
function insideWindow(start, duration, wake, sleep) {
  const end = start + duration
  if (sleep > wake) return start >= wake && end <= sleep
  // Window wraps past midnight (e.g. wake 07:00, sleep 01:00).
  const s = start < wake ? start + 1440 : start
  return s >= wake && s + duration <= sleep + 1440
}

function cleanTitle(line) {
  const cleaned = line
    .replace(RANGE, ' ').replace(POINT_COLON, ' ').replace(POINT_AMPM, ' ').replace(POINT_BAJE, ' ').replace(DURATION, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b(must|should|could|zaroori|jaruri|important|baje|tak|se|subah|shaam|sham|raat|dopahar|dopehar|morning|evening|night|afternoon|at|from)\b|ज़रूरी|जरूरी|बजे|तक|सुबह|शाम|रात|दोपहर/gi, ' ')
    .replace(/[(),:–—-]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  return cleaned || line.trim()
}

/**
 * @param {string} text diary text
 * @param {{wakeTime?:string, sleepTime?:string}} options waking window (defaults 06:00–22:30)
 */
/**
 * parseDiary function
 * @param {any} text, options = {}
 * @returns {any}
 */
export function parseDiary(text, options = {}) {
  const wake = clockToMinutes(options.wakeTime) ?? 6 * 60
  const sleep = clockToMinutes(options.sleepTime) ?? 22 * 60 + 30
  let previousStart = null
  return splitDiary(text).map(rawLine => {
    const line = normaliseDiaryLine(rawLine)
    const context = contextOf(line)
    const clockText = line.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    const duration = line.match(DURATION)
    const durationMinutes = duration ? Math.round(Number(duration[1]) * (/^(h|घं|gh)/i.test(duration[2]) ? 60 : 1)) : null
    let startTime = '', estimateMinutes = durationMinutes ?? 30, warning = '', endsNextDay = false, periodInferred = false, ambiguity = null
    const range = clockText.match(RANGE)
    const colon = !range && clockText.match(POINT_COLON)
    const ampm = !range && !colon && clockText.match(POINT_AMPM)
    const baje = !range && !colon && !ampm && clockText.match(POINT_BAJE)
    const point = colon || ampm || baje
    if (range) {
      const a = { hour: Number(range[1]), minute: Number(range[2] || 0), period: range[3], raw: range[1] }
      const b = { hour: Number(range[4]), minute: Number(range[5] || 0), period: range[6], raw: range[4] }
      // A period on one side applies to an unmarked other side ("9-11am").
      if (!a.period && b.period && a.hour <= b.hour) a.period = b.period
      if (!b.period && a.period && b.hour >= a.hour && b.hour !== 12) b.period = a.period
      const pairs = []
      for (const s of readings(a, context)) for (const e of readings(b, context)) {
        const span = (e - s + 1440) % 1440
        if (span > 0 && span <= 12 * 60) pairs.push({ start: s, span })
      }
      const unique = [...new Map(pairs.map(p => [`${p.start}-${p.span}`, p])).values()]
      let fit = unique.length > 1 ? unique.filter(p => insideWindow(p.start, p.span, wake, sleep)) : unique
      if (fit.length > 1 && previousStart != null) {
        const after = fit.filter(p => p.start >= previousStart).sort((x, y) => x.start - y.start)
        if (after.length) { fit = [after[0]]; periodInferred = true }
      }
      if (fit.length === 1) {
        startTime = minuteClock(fit[0].start); estimateMinutes = fit[0].span; endsNextDay = fit[0].start + fit[0].span >= 1440
      } else if (fit.length > 1 || unique.length > 1) {
        const options = (fit.length ? fit : unique).slice(0, 2)
        warning = `“${range[0].trim()}” — AM/PM? Choose one before approving.`
        ambiguity = { options: options.map(p => ({ label: `${label12(p.start)} – ${label12((p.start + p.span) % 1440)}`, startTime: minuteClock(p.start), estimateMinutes: p.span, endsNextDay: p.start + p.span >= 1440 })) }
        estimateMinutes = options[0].span
      } else warning = 'This range is ambiguous. Specify AM/PM for both ends or edit its duration.'
    } else if (point) {
      const token = colon ? { hour: Number(colon[1]), minute: Number(colon[2]), period: colon[3], raw: colon[1] }
        : ampm ? { hour: Number(ampm[1]), minute: 0, period: ampm[2], raw: ampm[1] }
        : { hour: Number(baje[1]), minute: 0, period: '', raw: baje[1] }
      const all = readings(token, context)
      let fit = all.length > 1 ? all.filter(s => insideWindow(s, estimateMinutes, wake, sleep)) : all
      if (fit.length > 1 && previousStart != null) {
        const after = fit.filter(s => s >= previousStart).sort((x, y) => x - y)
        if (after.length) { fit = [after[0]]; periodInferred = true }
      }
      if (fit.length === 1) { startTime = minuteClock(fit[0]); endsNextDay = fit[0] + estimateMinutes > 1440 }
      else {
        const options = (fit.length ? fit : all).slice(0, 2)
        warning = `“${point[0].trim()}” — AM/PM? Choose one before approving.`
        ambiguity = { options: options.map(s => ({ label: label12(s), startTime: minuteClock(s), estimateMinutes, endsNextDay: false })) }
      }
    }
    if (startTime) previousStart = clockToMinutes(startTime)
    const priority = /\bmust\b|zaroori|jaruri|ज़रूरी|जरूरी|\bimportant\b|!{2,}/i.test(line) ? 'must' : /\bcould\b|\bmaybe\b|agar time/i.test(line) ? 'could' : 'should'
    return {
      id: uid('block'), taskId: uid('task'), title: cleanTitle(line), rawLine: rawLine.trim(),
      estimateMinutes, originalEstimateMinutes: estimateMinutes, estimateAssumed: durationMinutes == null && !range,
      startTime, endsNextDay, reminderMinutes: 10, priority, fixed: Boolean(startTime),
      category: guessCategory(line), completionCriterion: '', explicitDate: line.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || '',
      warning, ambiguity, periodInferred, source: 'diary-draft',
    }
  })
}

/** Apply one of the ambiguity options to a parsed task (UI one-tap resolve). */
/**
 * resolveAmbiguity function
 * @param {any} task, option
 * @returns {any}
 */
export function resolveAmbiguity(task, option) {
  return { ...task, startTime: option.startTime, estimateMinutes: option.estimateMinutes, originalEstimateMinutes: task.originalEstimateMinutes ?? option.estimateMinutes, endsNextDay: Boolean(option.endsNextDay), fixed: true, warning: '', ambiguity: null }
}

/** Auto-suggested implementation intention for a Must block (plan §12.1). */
/**
 * suggestIntention function
 * @param {any} block
 * @returns {any}
 */
export function suggestIntention(block) {
  if (!block?.startTime) return ''
  const first = { Study: 'open my notes and start the first problem', Exercise: 'put on my shoes and start the warm-up', 'Deep Work': 'close chats and open the main file', Meals: 'step away from the screen', Sleep: 'put the phone away and switch off the lights' }[block.category] || `start “${block.title}”`
  return `If it's ${block.startTime}, then I ${first}.`
}


