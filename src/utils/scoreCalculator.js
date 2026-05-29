import { getTodayDateKey } from './dateTime'

export function calcLifeScore(state) {
  const habits = state?.habits || { checkpoints: [], dailyLogs: [] }
  const study = state?.study || { sessions: [] }
  const finance = state?.finance || { expenses: [] }
  const timeflow = state?.timeflow || { entries: [] }
  const settings = state?.settings || {}
  const timezone = settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const preferences = settings?.preferences || {}
  const dailyStudyGoal = preferences?.dailyStudyGoal ?? 6
  const monthlyBudget = preferences?.monthlyBudget ?? 8000
  const dailyWasteLimit = preferences?.dailyWasteLimit ?? 2

  const todayLogs = (habits.dailyLogs || []).filter(l => l.date === today)
  const doneLogs = todayLogs.filter(l => l.status === 'done').length
  const totalCheckpoints = (habits.checkpoints || []).length

  const checkpointScore =
    totalCheckpoints > 0
      ? Math.min(100, (doneLogs / totalCheckpoints) * 100)
      : 50

  const todaySessions = (study.sessions || []).filter(s => s.date === today)
  const studyMins = todaySessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
  const studyScore = Math.min(100, (studyMins / (dailyStudyGoal * 60)) * 100)

  const dailyBudget = monthlyBudget / 30
  const todaySpend = (finance.expenses || [])
    .filter(e => e.date === today)
    .reduce((a, e) => a + (Number(e.amount) || 0), 0)

  const financeScore =
    todaySpend <= dailyBudget
      ? 100
      : Math.max(0, 100 - ((todaySpend - dailyBudget) / dailyBudget) * 100)

  const todayEntries = (timeflow.entries || []).filter(e => e.date === today)
  const wasteMins = todayEntries
    .filter(e => e.isWaste)
    .reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)

  const wasteScore =
    wasteMins <= dailyWasteLimit * 60
      ? 100
      : Math.max(0, 100 - ((wasteMins - dailyWasteLimit * 60) / 60) * 20)

  const total = Math.round(
    checkpointScore * 0.30 +
    studyScore * 0.25 +
    financeScore * 0.20 +
    wasteScore * 0.15 +
    50 * 0.10
  )

  return {
    total: Math.min(100, Math.max(0, total)),
    checkpointScore: Math.round(checkpointScore),
    studyScore: Math.round(studyScore),
    financeScore: Math.round(financeScore),
    wasteScore: Math.round(wasteScore),
  }
}