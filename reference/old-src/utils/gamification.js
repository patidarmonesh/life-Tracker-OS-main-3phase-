import { getTodayDateKey } from './dateTime'

// ── Level thresholds ─────────────────────────────────────────
const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500,
  7500, 10000, 13000, 16500, 20500, 25000, 30000, 35500,
  41500, 48000, 55000, 62500, 71000, 80000, 90000, 100000,
]

// ── Badges ───────────────────────────────────────────────────
export const BADGES = [
  {
    id: 'first_expense',
    name: 'First Penny',
    emoji: '💰',
    desc: 'Log your first expense',
    check: s => (s.finance?.expenses?.length || 0) >= 1,
  },
  {
    id: 'study_5h',
    name: 'Bookworm',
    emoji: '📚',
    desc: 'Study 5+ hours in a day',
    check: s => {
      const sessions = s.study?.sessions || []
      const byDate = {}
      sessions.forEach(sess => {
        const d = sess.date
        byDate[d] = (byDate[d] || 0) + (Number(sess.durationMinutes) || 0)
      })
      return Object.values(byDate).some(mins => mins >= 300)
    },
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    emoji: '🔥',
    desc: '7-day habit streak',
    check: s => {
      return getBestStreak(s) >= 7
    },
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    emoji: '👑',
    desc: '30-day habit streak',
    check: s => {
      return getBestStreak(s) >= 30
    },
  },
  {
    id: 'under_budget_7',
    name: 'Budget Boss',
    emoji: '💵',
    desc: 'Under budget 7 days straight',
    check: s => {
      return getUnderBudgetStreak(s) >= 7
    },
  },
  {
    id: 'journal_10',
    name: 'Reflector',
    emoji: '✍️',
    desc: 'Write 10 journal entries',
    check: s => (s.journal?.entries?.length || 0) >= 10,
  },
  {
    id: 'score_90',
    name: 'Life Hacker',
    emoji: '🏆',
    desc: 'Life Score 90+',
    check: (s, extra) => (extra?.lifeScore ?? 0) >= 90,
  },
  {
    id: 'all_modules',
    name: 'Renaissance',
    emoji: '🌟',
    desc: 'Use all 6 modules in one day',
    check: s => {
      const timezone = s.settings?.profile?.timezone
      const today = getTodayDateKey(timezone)
      const hasExpense = (s.finance?.expenses || []).some(e => e.date === today)
      const hasStudy = (s.study?.sessions || []).some(sess => sess.date === today)
      const hasHabit = (s.habits?.dailyLogs || []).some(l => l.date === today && l.status === 'done')
      const hasJournal = (s.journal?.entries || []).some(e => e.date === today)
      const hasTimeflow = (s.timeflow?.entries || []).some(e => e.date === today)
      const hasHealth = (s.health?.bodyLogs || []).some(l => l.date === today)
      return hasExpense && hasStudy && hasHabit && hasJournal && hasTimeflow && hasHealth
    },
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    emoji: '🌅',
    desc: 'Log something before 7 AM',
    check: s => {
      return hasLogAtHour(s, 0, 7)
    },
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    emoji: '🦉',
    desc: 'Log something after 11 PM',
    check: s => {
      return hasLogAtHour(s, 23, 24)
    },
  },
]

// ── Helpers ──────────────────────────────────────────────────

function hasLogAtHour(state, fromHour, toHour) {
  const allTimestamps = []

  ;(state.finance?.expenses || []).forEach(e => {
    if (e.createdAt) allTimestamps.push(e.createdAt)
    if (e.loggedAt) allTimestamps.push(e.loggedAt)
  })
  ;(state.study?.sessions || []).forEach(s => {
    if (s.createdAt) allTimestamps.push(s.createdAt)
    if (s.loggedAt) allTimestamps.push(s.loggedAt)
  })
  ;(state.habits?.dailyLogs || []).forEach(l => {
    if (l.loggedAt) allTimestamps.push(l.loggedAt)
  })
  ;(state.journal?.entries || []).forEach(e => {
    if (e.createdAt) allTimestamps.push(e.createdAt)
  })
  ;(state.timeflow?.entries || []).forEach(e => {
    if (e.createdAt) allTimestamps.push(e.createdAt)
    if (e.loggedAt) allTimestamps.push(e.loggedAt)
  })
  ;(state.health?.bodyLogs || []).forEach(l => {
    if (l.createdAt) allTimestamps.push(l.createdAt)
    if (l.loggedAt) allTimestamps.push(l.loggedAt)
  })

  return allTimestamps.some(ts => {
    try {
      const hour = new Date(ts).getHours()
      return hour >= fromHour && hour < toHour
    } catch {
      return false
    }
  })
}

function getBestStreak(state) {
  const checkpoints = (state.habits?.checkpoints || []).filter(c => c.isActive)
  if (checkpoints.length === 0) return 0

  const logs = state.habits?.dailyLogs || []
  let best = 0

  checkpoints.forEach(cp => {
    const cpLogs = logs
      .filter(l => l.checkpointId === cp.id)
      .sort((a, b) => b.date.localeCompare(a.date))

    let streak = 0
    for (const log of cpLogs) {
      if (log.status === 'done') streak++
      else break
    }
    if (streak > best) best = streak
  })

  return best
}

function getUnderBudgetStreak(state) {
  const expenses = state.finance?.expenses || []
  const preferences = state.settings?.preferences || {}
  const monthlyBudget = preferences.monthlyBudget || 8000
  const dailyBudget = monthlyBudget / 30

  // Get all unique expense dates and sort descending
  const dateSpend = {}
  expenses.forEach(e => {
    const d = e.date
    if (!d) return
    dateSpend[d] = (dateSpend[d] || 0) + (Number(e.amount) || 0)
  })

  const sortedDates = Object.keys(dateSpend).sort((a, b) => b.localeCompare(a))
  let streak = 0
  for (const d of sortedDates) {
    if (dateSpend[d] <= dailyBudget) streak++
    else break
  }
  return streak
}

function getDailyAllHabitStreakDays(state) {
  const checkpoints = (state.habits?.checkpoints || []).filter(c => c.isActive)
  if (checkpoints.length === 0) return 0

  const logs = state.habits?.dailyLogs || []

  // Group logs by date
  const byDate = {}
  logs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = new Set()
    if (l.status === 'done') byDate[l.date].add(l.checkpointId)
  })

  // Count days where ALL active checkpoints were completed
  const cpIds = new Set(checkpoints.map(c => c.id))
  let count = 0
  Object.values(byDate).forEach(doneSet => {
    const allDone = [...cpIds].every(id => doneSet.has(id))
    if (allDone) count++
  })
  return count
}

function getUnderBudgetDays(state) {
  const expenses = state.finance?.expenses || []
  const preferences = state.settings?.preferences || {}
  const monthlyBudget = preferences.monthlyBudget || 8000
  const dailyBudget = monthlyBudget / 30

  const dateSpend = {}
  expenses.forEach(e => {
    const d = e.date
    if (!d) return
    dateSpend[d] = (dateSpend[d] || 0) + (Number(e.amount) || 0)
  })

  return Object.values(dateSpend).filter(s => s <= dailyBudget).length
}

// ── XP Calculation ───────────────────────────────────────────
export function calculateXP(state) {
  let xp = 0

  // Each expense logged: +5 XP
  const expenses = state.finance?.expenses || []
  xp += expenses.length * 5

  // Each study session: +10 XP per hour
  const sessions = state.study?.sessions || []
  const totalStudyMins = sessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
  xp += Math.floor(totalStudyMins / 60) * 10

  // Each habit completed: +15 XP
  const habitLogs = state.habits?.dailyLogs || []
  const completedHabits = habitLogs.filter(l => l.status === 'done').length
  xp += completedHabits * 15

  // Each journal entry: +10 XP
  const journalEntries = state.journal?.entries || []
  xp += journalEntries.length * 10

  // Each timeflow entry: +5 XP
  const timeflowEntries = state.timeflow?.entries || []
  xp += timeflowEntries.length * 5

  // Each health log: +5 XP
  const healthLogs = state.health?.bodyLogs || []
  xp += healthLogs.length * 5

  // Daily all-habits streak bonus: +50 XP per perfect day
  xp += getDailyAllHabitStreakDays(state) * 50

  // Under budget day: +20 XP per day
  xp += getUnderBudgetDays(state) * 20

  return xp
}

// ── Level ────────────────────────────────────────────────────
export function getLevel(xp) {
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
      break
    }
  }
  return Math.min(level, LEVEL_THRESHOLDS.length)
}

export function getXPForNextLevel(xp) {
  const level = getLevel(xp)
  if (level >= LEVEL_THRESHOLDS.length) return null // Max level
  return LEVEL_THRESHOLDS[level]
}

export function getLevelProgress(xp) {
  const level = getLevel(xp)
  if (level >= LEVEL_THRESHOLDS.length) return 1 // Max level

  const currentThreshold = LEVEL_THRESHOLDS[level - 1]
  const nextThreshold = LEVEL_THRESHOLDS[level]
  const range = nextThreshold - currentThreshold
  if (range <= 0) return 1

  return Math.min(1, Math.max(0, (xp - currentThreshold) / range))
}

// ── Badges ───────────────────────────────────────────────────
export function getUnlockedBadges(state, extra = {}) {
  return BADGES.filter(b => {
    try {
      return b.check(state, extra)
    } catch {
      return false
    }
  })
}
