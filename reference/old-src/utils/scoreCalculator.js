import { getTodayDateKey } from './dateTime'

const DEFAULT_WEIGHTS = {
  habits: { weight: 30, enabled: true },
  study: { weight: 25, enabled: true },
  finance: { weight: 20, enabled: true },
  timeflow: { weight: 15, enabled: true },
  journal: { weight: 10, enabled: true },
}

export function getScoreWeights(settings) {
  const custom = settings?.preferences?.scoreWeights
  if (!custom) return DEFAULT_WEIGHTS

  // Ensure all components exist
  return {
    habits: { weight: custom.habits?.weight ?? 30, enabled: custom.habits?.enabled !== false },
    study: { weight: custom.study?.weight ?? 25, enabled: custom.study?.enabled !== false },
    finance: { weight: custom.finance?.weight ?? 20, enabled: custom.finance?.enabled !== false },
    timeflow: { weight: custom.timeflow?.weight ?? 15, enabled: custom.timeflow?.enabled !== false },
    journal: { weight: custom.journal?.weight ?? 10, enabled: custom.journal?.enabled !== false },
  }
}

export function calcLifeScore(state) {
  const habits = state?.habits || { checkpoints: [], dailyLogs: [] }
  const study = state?.study || { sessions: [] }
  const finance = state?.finance || { expenses: [] }
  const timeflow = state?.timeflow || { entries: [] }
  const journal = state?.journal || { entries: [] }
  const settings = state?.settings || {}
  const timezone = settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const preferences = settings?.preferences || {}
  const dailyStudyGoal = preferences?.dailyStudyGoal ?? 6
  const monthlyBudget = preferences?.monthlyBudget ?? 8000
  const dailyWasteLimit = preferences?.dailyWasteLimit ?? 2

  // Get user's custom weights
  const weights = getScoreWeights(settings)

  // ── Component scores ──────────────────────────────────────

  // Habits
  const todayLogs = (habits.dailyLogs || []).filter(l => l.date === today)
  const doneLogs = todayLogs.filter(l => l.status === 'done').length
  const totalCheckpoints = (habits.checkpoints || []).length
  const checkpointScore =
    totalCheckpoints > 0
      ? Math.min(100, (doneLogs / totalCheckpoints) * 100)
      : 50

  // Study
  const todaySessions = (study.sessions || []).filter(s => s.date === today)
  const studyMins = todaySessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
  const studyScore = Math.min(100, (studyMins / (dailyStudyGoal * 60)) * 100)

  // Finance
  const dailyBudget = monthlyBudget / 30
  const todaySpend = (finance.expenses || [])
    .filter(e => e.date === today)
    .reduce((a, e) => a + (Number(e.amount) || 0), 0)
  const financeScore =
    todaySpend <= dailyBudget
      ? 100
      : Math.max(0, 100 - ((todaySpend - dailyBudget) / dailyBudget) * 100)

  // TimeFlow (waste time)
  const todayEntries = (timeflow.entries || []).filter(e => e.date === today)
  const wasteMins = todayEntries
    .filter(e => e.isWaste)
    .reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)
  const wasteScore =
    wasteMins <= dailyWasteLimit * 60
      ? 100
      : Math.max(0, 100 - ((wasteMins - dailyWasteLimit * 60) / 60) * 20)

  // Journal (did they write today?)
  const todayJournals = (journal.entries || []).filter(e => e.date === today)
  const journalScore = todayJournals.length > 0 ? 100 : 0

  // ── Weighted total ────────────────────────────────────────
  const components = {
    habits: checkpointScore,
    study: studyScore,
    finance: financeScore,
    timeflow: wasteScore,
    journal: journalScore,
  }

  // Calculate total active weight for normalization
  let totalWeight = 0
  Object.entries(weights).forEach(([key, config]) => {
    if (config.enabled) totalWeight += config.weight
  })

  // If nothing is enabled, return 50
  if (totalWeight === 0) {
    return {
      total: 50,
      checkpointScore: Math.round(checkpointScore),
      studyScore: Math.round(studyScore),
      financeScore: Math.round(financeScore),
      wasteScore: Math.round(wasteScore),
      journalScore: Math.round(journalScore),
      breakdown: {},
    }
  }

  let total = 0
  const breakdown = {}

  Object.entries(weights).forEach(([key, config]) => {
    if (!config.enabled) {
      breakdown[key] = { score: Math.round(components[key]), weight: 0, contribution: 0, enabled: false }
      return
    }
    const normalizedWeight = config.weight / totalWeight
    const contribution = components[key] * normalizedWeight
    total += contribution
    breakdown[key] = {
      score: Math.round(components[key]),
      weight: Math.round(normalizedWeight * 100),
      contribution: Math.round(contribution),
      enabled: true,
    }
  })

  return {
    total: Math.min(100, Math.max(0, Math.round(total))),
    checkpointScore: Math.round(checkpointScore),
    studyScore: Math.round(studyScore),
    financeScore: Math.round(financeScore),
    wasteScore: Math.round(wasteScore),
    journalScore: Math.round(journalScore),
    breakdown,
  }
}