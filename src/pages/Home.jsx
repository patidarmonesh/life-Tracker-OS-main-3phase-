import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { useAuth } from '../context/appContextCore'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { calcLifeScore } from '../utils/scoreCalculator'
import ScoreRing from '../components/ui/ScoreRing'
import Card from '../components/ui/Card'
import XPBar from '../components/ui/XPBar'
import BadgeGrid from '../components/ui/BadgeGrid'
import { Plus, Sparkles, Zap, ArrowRight, BarChart3, Brain, Shield, TrendingUp, BookOpen, Target } from 'lucide-react'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { formatCurrencyAmount } from '../utils/currency'
import { getTodayDateKey } from '../utils/dateTime'
import { generateDailyInsight, getGeminiApiKey } from '../services/geminiService'
import { useCountUp } from '../hooks/useCountUp'
import { useToast } from '../context/toastContextCore'
import NLInput from '../components/ui/NLInput'
import WeeklySummary from '../components/ui/WeeklySummary'
import { playSuccessSound, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import SmartReminders from '../components/ui/SmartReminders'

export default function Home() {
  const state = useAppState()
  const { setModule, patchModule } = useAppActions()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const timezone = state.settings?.profile?.timezone
  const currency = state.settings?.profile?.currency || 'INR'
  const today = getTodayDateKey(timezone)
  const [fabOpen, setFabOpen] = useState(false)
  const [aiInsight, setAiInsight] = useState('')
  const [aiInsightLoading, setAiInsightLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showWeeklySummary, setShowWeeklySummary] = useState(false)
  const confettiTimeoutRef = useRef(null)
  const [energyLevel, setEnergyLevel] = useState(3)
  const [energyNotes, setEnergyNotes] = useState('')
  const [showLifeCoach, setShowLifeCoach] = useState(false)
  const [lifeCoachLoading, setLifeCoachLoading] = useState(false)
  const [lifeCoachResult, setLifeCoachResult] = useState(null)
  const [lifeCoachSaved, setLifeCoachSaved] = useState(false)
  const [isCompactHero, setIsCompactHero] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 920 : false
  )

  useEffect(() => {
    const onResize = () => setIsCompactHero(window.innerWidth < 920)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const scores = useMemo(() => calcLifeScore(state), [state])
  const animatedScore = useCountUp(scores.total)
  const animatedCheckpointScore = useCountUp(scores.checkpointScore)
  const animatedStudyScore = useCountUp(scores.studyScore)
  const animatedFinanceScore = useCountUp(scores.financeScore)
  const animatedWasteScore = useCountUp(scores.wasteScore)
  const animatedJournalScore = useCountUp(scores.journalScore ?? 0)
  const preferences = state.settings?.preferences || {}
  const profile = state.settings?.profile || {}

  const todayExpenses = (state.finance?.expenses || []).filter(e => e.date === today)
  const todaySpend = todayExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)
  const dailyBudget = Math.round((preferences.monthlyBudget || 8000) / 30)

  const todaySessions = (state.study?.sessions || []).filter(s => s.date === today)
  const studyMins = todaySessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
  const studyGoalMins = (preferences.dailyStudyGoal || 6) * 60

  const todayTimeEntries = (state.timeflow?.entries || []).filter(e => e.date === today)
  const wasteMins = todayTimeEntries
    .filter(e => e.isWaste)
    .reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)

  const todayLogs = (state.habits?.dailyLogs || []).filter(l => l.date === today)
  const todayBodyLog = (state.health?.bodyLogs || []).find(l => l.date === today)
  const todayHealth = todayBodyLog || {}
  
  const waterLogs = state.health?.waterLogs || []
  const todayWaterLogs = waterLogs.filter(w => w.date === today)
  const todayWaterTotal = todayWaterLogs.reduce((acc, log) => acc + (log.amountMl || 0), 0)
  const waterGoal = preferences.waterGoal || 3000

  function logWaterHome(amountMl) {
    const newLog = {
      id: 'water_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      amountMl: parseInt(amountMl),
      date: today,
      timestamp: new Date().toISOString(),
    }
    const updatedLogs = [...waterLogs, newLog]
    const prevTotal = todayWaterTotal
    const nextTotal = prevTotal + amountMl
    if (nextTotal >= waterGoal && prevTotal < waterGoal) {
      showToast('🎉 Hydration Goal Achieved! Fantastic job!', 'success')
      playSuccessSound()
      hapticSuccess()
    } else {
      playSuccessSound()
      hapticSuccess()
    }
    setModule('health', {
      ...state.health,
      waterLogs: updatedLogs
    })
  }

  const checkpoints = (state.habits?.checkpoints || []).filter(c => c.isActive)

  const getCheckpointStatus = cpId =>
    todayLogs.find(l => l.checkpointId === cpId)?.status || null

  function toggleCheckpoint(cpId) {
    const existing = todayLogs.find(l => l.checkpointId === cpId)
    const allLogs = state.habits?.dailyLogs || []

    const newLogs = existing
      ? allLogs.map(l =>
          l.checkpointId === cpId && l.date === today
            ? { ...l, status: l.status === 'done' ? null : 'done' }
            : l
        )
      : [
          ...allLogs,
          {
          id: uuid(),
            checkpointId: cpId,
            date: today,
            status: 'done',
            value: null,
            note: '',
            loggedAt: new Date().toISOString(),
          },
        ]

    setModule('habits', { ...state.habits, dailyLogs: newLogs })

    // Check if all checkpoints are now done → confetti burst
    if (checkpoints.length > 0) {
      const updatedLogs = newLogs.filter(l => l.date === today)
      const doneCount = updatedLogs.filter(l => l.status === 'done').length
      if (doneCount >= checkpoints.length) {
        if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current)
        setShowConfetti(true)
        confettiTimeoutRef.current = setTimeout(() => setShowConfetti(false), 2500)
      }
    }
  }

  const getStreak = useCallback((cpId) => {
    let streak = 0

    const logs = (state.habits?.dailyLogs || [])
      .filter(l => l.checkpointId === cpId)
      .sort((a, b) => b.date.localeCompare(a.date))

    for (const log of logs) {
      if (log.status === 'done') streak++
      else break
    }

    return streak
  }, [state.habits?.dailyLogs])

  const bestStreak = useMemo(
    () => Math.max(0, ...checkpoints.map(c => getStreak(c.id))),
    [checkpoints, getStreak]
  )
  const animatedBestStreak = useCountUp(bestStreak)
  const animatedSteps = useCountUp(todayHealth.steps || 0)

  const completedToday = todayLogs.filter(l => l.status === 'done').length
  const completionPct =
    checkpoints.length > 0 ? Math.round((completedToday / checkpoints.length) * 100) : 0

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙'

  const displayName = profile.name || user?.name?.split(' ')[0] || 'Ravish'

  const fallbackInsight = studyMins < 60
    ? `You haven't logged much study time today yet. A short focused session right now would improve your momentum more than trying to catch up late at night.`
    : `You've studied ${(studyMins / 60).toFixed(1)} hours today. ${
        wasteMins > 60
          ? `Your main drag is ${(wasteMins / 60).toFixed(1)}h of waste time, so reducing distractions will improve your total score fast.`
          : `Your focus looks solid today - keep this rhythm and close the day with one more clean win.`
      }`

  async function handleGenerateInsight() {
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setAiInsight('Add your Gemini API key in Settings to generate a personalized daily insight.')
      return
    }

    setAiInsightLoading(true)
    try {
      const insight = await generateDailyInsight({
        apiKey,
        summary: [
          `Life score: ${scores.total}`,
          `Study today: ${(studyMins / 60).toFixed(1)} hours out of ${(studyGoalMins / 60).toFixed(1)} hours goal`,
          `Spend today: ${formatCurrencyAmount(todaySpend, currency)} out of ${formatCurrencyAmount(dailyBudget, currency)} daily budget`,
          `Waste time today: ${(wasteMins / 60).toFixed(1)} hours`,
          `Habits completed: ${completedToday}/${checkpoints.length}`,
          `Steps: ${(todayHealth.steps || 0).toLocaleString()}`,
          `Sleep: ${(Number(todayHealth.sleepHours) || 0).toFixed(1)} hours`,
        ].join('\n'),
      })
      setAiInsight(insight || fallbackInsight)
    } catch (error) {
      setAiInsight(error.message || 'Could not generate insight right now.')
    } finally {
      setAiInsightLoading(false)
    }
  }

  function handleLogEnergy() {
    const newLog = {
      id: uuid(),
      date: today,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      level: Number(energyLevel),
      notes: energyNotes.trim(),
      createdAt: new Date().toISOString()
    }
    const updatedLogs = [newLog, ...(state.health?.energyLogs || [])]
    setModule('health', {
      ...state.health,
      energyLogs: updatedLogs
    })
    setEnergyNotes('')
    showToast('Logged energy level! ⚡', 'success')
  }

  // ── AI Life Coach ────────────────────────────────────────────
  async function runLifeCoach() {
    setLifeCoachLoading(true)
    setLifeCoachResult(null)
    setLifeCoachSaved(false)
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setLifeCoachLoading(false)
      setLifeCoachResult({ error: true, message: 'No Gemini API key found. Go to Settings → API Keys.' })
      return
    }

    try {
      const tz = timezone
      const todayKey = today

      // ── Gather Habits Data ──
      const allHabits = (state.habits?.checkpoints || []).filter(h => h.isActive !== false)
      const allLogs = state.habits?.dailyLogs || []
      const todayHabitLogs = allLogs.filter(l => l.date === todayKey)
      const missedToday = allHabits.filter(h => !todayHabitLogs.some(l => l.checkpointId === h.id && l.status === 'done'))
      const doneToday = allHabits.filter(h => todayHabitLogs.some(l => l.checkpointId === h.id && l.status === 'done'))
      const nonNegMissed = missedToday.filter(h => h.nonNegotiable)

      // Habit streaks for last 7 days per habit
      const habitSummary = allHabits.map(h => {
        let streak = 0
        for (let i = 0; i < 30; i++) {
          const dk = format(subDays(new Date(), i), 'yyyy-MM-dd')
          if (allLogs.some(l => l.checkpointId === h.id && l.date === dk && l.status === 'done')) streak++
          else if (i > 0) break
        }
        const last7 = Array.from({ length: 7 }, (_, i) => {
          const dk = format(subDays(new Date(), i), 'yyyy-MM-dd')
          return allLogs.some(l => l.checkpointId === h.id && l.date === dk && l.status === 'done')
        })
        return `- ${h.icon || '🎯'} ${h.title || h.name}${h.nonNegotiable ? ' [NON-NEGOTIABLE 🔒]' : ''}: streak=${streak}d, last7=${last7.filter(Boolean).length}/7, todayDone=${doneToday.some(d => d.id === h.id) ? 'YES' : 'NO'}`
      }).join('\n')

      // ── Study Data (last 7 days) ──
      const studySessions = state.study?.sessions || []
      const last7StudyMins = Array.from({ length: 7 }, (_, i) => {
        const dk = format(subDays(new Date(), i), 'yyyy-MM-dd')
        return studySessions.filter(s => s.date === dk).reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
      })
      const studyTrend = `Last 7 days study (mins): [${last7StudyMins.reverse().join(', ')}]`

      // ── Timeline Data (last 3 days) ──
      const timeEntries = state.timeflow?.entries || []
      const last3Timeline = Array.from({ length: 3 }, (_, i) => {
        const dk = format(subDays(new Date(), i), 'yyyy-MM-dd')
        const dayEntries = timeEntries.filter(e => e.date === dk)
        const waste = dayEntries.filter(e => e.isWaste).reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)
        const productive = dayEntries.filter(e => !e.isWaste).reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)
        return `${dk}: productive=${(productive/60).toFixed(1)}h, waste=${(waste/60).toFixed(1)}h`
      }).join('\n')

      // ── Finance Data ──
      const transactions = state.finance?.transactions || []
      const expenses = state.finance?.expenses || []
      const allFinance = [...transactions, ...expenses]
      const last7Spend = Array.from({ length: 7 }, (_, i) => {
        const dk = format(subDays(new Date(), i), 'yyyy-MM-dd')
        return allFinance.filter(t => t.date === dk && (t.type === 'expense' || !t.type)).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      })
      const financeSummary = `Last 7 days spending: [${last7Spend.reverse().map(s => Math.round(s)).join(', ')}] INR`

      // ── Journal ──
      const journals = (state.journal?.entries || []).slice(0, 5)
      const journalSummary = journals.map(j => `- ${j.date}: "${j.title}" (mood: ${j.mood}/5)`).join('\n')

      // ── Wisdoms ──
      const wisdoms = state.wisdom?.entries || []
      const wisdomTexts = wisdoms.slice(0, 10).map(w => `- "${w.text}" (source: ${w.source || 'self'}, category: ${w.category || 'life'})`).join('\n')

      // ── Goals ──
      const goals = state.goals?.items || []
      const activeGoals = goals.filter(g => g.status === 'active' || !g.status)
      const goalsSummary = activeGoals.slice(0, 5).map(g => `- ${g.title} (progress: ${g.progress || 0}%, priority: ${g.priority || 'medium'})`).join('\n')

      // Build the mega prompt
      const prompt = `You are a STRICT, CARING, BRUTALLY HONEST AI Life Coach. The user's name is ${displayName}. Your job is to analyze their ENTIRE life data and give them tough love + motivation.

IMPORTANT RULES:
1. If there are NON-NEGOTIABLE habits that are missed today, you MUST SCOLD the user aggressively but caringly. These habits are marked [NON-NEGOTIABLE 🔒]. Be harsh but motivating like a strict coach.
2. Pick 2-3 wisdoms from their own wisdom collection and REMIND them to follow those wisdoms today.
3. Compare their recent data to find IMPROVEMENT TRENDS. If they're improving, celebrate it. If declining, call it out.
4. Be specific with numbers and data. Don't be vague.
5. Write in a casual Hinglish style (Hindi-English mix) like a friend who's also a strict coach.

=== TODAY'S DATE: ${todayKey} ===

=== HABITS (${allHabits.length} total, ${doneToday.length} done today, ${missedToday.length} missed) ===
${habitSummary}

MISSED TODAY: ${missedToday.map(h => `${h.icon || '🎯'} ${h.title || h.name}${h.nonNegotiable ? ' [NON-NEGOTIABLE]' : ''}`).join(', ') || 'None — Perfect!'}
NON-NEGOTIABLE MISSED: ${nonNegMissed.map(h => `${h.icon || '🎯'} ${h.title || h.name}`).join(', ') || 'None'}

=== STUDY TREND ===
${studyTrend}
Today so far: ${studyMins} mins (goal: ${studyGoalMins} mins)

=== TIMELINE (last 3 days) ===
${last3Timeline}

=== FINANCE ===
${financeSummary}
Today spent: ${todaySpend} INR (daily budget: ${dailyBudget} INR)

=== RECENT JOURNALS ===
${journalSummary || 'No recent journals'}

=== USER\'S OWN WISDOMS ===
${wisdomTexts || 'No wisdoms saved yet'}

=== ACTIVE GOALS ===
${goalsSummary || 'No active goals'}

=== LIFE SCORE: ${scores.total}/100 ===

Return ONLY valid JSON, no markdown:
{
  "overallVerdict": "One powerful sentence about their current state in Hinglish",
  "improvementTrend": {
    "direction": "improving" or "declining" or "stable",
    "details": "Specific data-backed explanation of trend in Hinglish",
    "motivationalLine": "A powerful motivation line if improving, or a wake-up call if declining"
  },
  "nonNegotiableScold": {
    "hasMissed": true/false,
    "message": "Strict scolding message in Hinglish for missed non-negotiable habits. Be harsh but caring. If none missed, write a proud message."
  },
  "missedHabitsAnalysis": [
    {
      "habitName": "name",
      "isNonNegotiable": true/false,
      "whyItMatters": "Why this habit is important",
      "suggestion": "When and how to do it today"
    }
  ],
  "wisdomReminders": [
    {
      "wisdom": "exact wisdom text from their collection",
      "howToApplyToday": "Specific way to apply this wisdom today"
    }
  ],
  "studyCoaching": {
    "currentStatus": "Assessment of study performance",
    "trendAnalysis": "Is study time increasing or decreasing over the week?",
    "todayTarget": "What they should aim for rest of today"
  },
  "financeCheck": {
    "status": "Are they within budget?",
    "tip": "One specific money-saving tip based on their data"
  },
  "topPriorities": ["Priority 1 for rest of today", "Priority 2", "Priority 3"],
  "closingMessage": "A powerful closing message that makes them feel like they can conquer the world. In Hinglish."
}`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4 },
          }),
        }
      )
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setLifeCoachResult(parsed)
        // Auto-save to journal
        saveLifeCoachToJournal(parsed)
      } else {
        setLifeCoachResult({ error: true, message: 'Could not parse AI response. Try again.' })
      }
    } catch (err) {
      console.error(err)
      setLifeCoachResult({ error: true, message: 'AI request failed. Check connection or API key.' })
    }
    setLifeCoachLoading(false)
  }

  function saveLifeCoachToJournal(result) {
    if (!result || result.error) return
    let content = `## 🧠 AI Life Coach Report — ${today}\n\n`
    content += `**Verdict:** ${result.overallVerdict}\n\n`

    if (result.improvementTrend) {
      const dir = result.improvementTrend.direction
      const emoji = dir === 'improving' ? '📈' : dir === 'declining' ? '📉' : '➡️'
      content += `## ${emoji} Trend: ${dir.toUpperCase()}\n${result.improvementTrend.details}\n\n`
      content += `> ${result.improvementTrend.motivationalLine}\n\n`
    }

    if (result.nonNegotiableScold) {
      content += `## 🔒 Non-Negotiable Check\n${result.nonNegotiableScold.message}\n\n`
    }

    if (result.missedHabitsAnalysis?.length > 0) {
      content += `## ❌ Missed Habits\n`
      result.missedHabitsAnalysis.forEach((h, i) => {
        content += `${i + 1}. **${h.habitName}**${h.isNonNegotiable ? ' 🔒' : ''}: ${h.whyItMatters}\n   💡 ${h.suggestion}\n`
      })
      content += '\n'
    }

    if (result.wisdomReminders?.length > 0) {
      content += `## 📚 Wisdom Reminders\n`
      result.wisdomReminders.forEach((w, i) => {
        content += `${i + 1}. "${w.wisdom}"\n   → ${w.howToApplyToday}\n`
      })
      content += '\n'
    }

    if (result.topPriorities?.length > 0) {
      content += `## 🎯 Top Priorities for Today\n`
      content += result.topPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n') + '\n\n'
    }

    if (result.closingMessage) {
      content += `## 💪 ${result.closingMessage}\n`
    }

    const journalEntries = state.journal?.entries || []
    const existingIdx = journalEntries.findIndex(e => e.date === today && e.source === 'ai-life-coach')
    const payload = {
      date: today,
      title: `🧠 AI Life Coach — ${today}`,
      content: content.trim(),
      mood: 3,
      energy: 3,
      gratitude: '',
      tags: ['ai-life-coach', 'auto-generated', 'daily-coaching'],
      source: 'ai-life-coach',
      aiSentiment: result.improvementTrend?.direction || 'Analysis',
      aiRecommendation: result.topPriorities ? result.topPriorities.join('; ') : '',
      updatedAt: new Date().toISOString(),
    }

    let updated
    if (existingIdx > -1) {
      updated = journalEntries.map((e, i) => i === existingIdx ? { ...e, ...payload } : e)
    } else {
      updated = [{ id: uuid(), ...payload, createdAt: new Date().toISOString() }, ...journalEntries]
    }
    setModule('journal', { ...state.journal, entries: updated })
    setLifeCoachSaved(true)
    showToast('Life Coach report saved to Journal ✓', 'success')
  }

  const fabActions = [
    { icon: '💸', label: 'Add Expense', action: () => navigate('/finance') },
    { icon: '⏱️', label: 'Log Time', action: () => navigate('/timeflow') },
    { icon: '✅', label: 'Checkpoint', action: () => navigate('/habits') },
    { icon: '📚', label: 'Study Session', action: () => navigate('/study') },
    { icon: '📝', label: 'Journal', action: () => navigate('/journal') },
    { icon: '🏥', label: 'Log Health', action: () => navigate('/health') },
  ]

  const scoreBreakdown = [
    { label: 'Habits', val: animatedCheckpointScore, color: '#7C82FF' },
    { label: 'Study', val: animatedStudyScore, color: '#58A6FF' },
    { label: 'Finance', val: animatedFinanceScore, color: '#35D39A' },
    { label: 'Waste', val: animatedWasteScore, color: '#F4B740' },
    { label: 'Journal', val: animatedJournalScore, color: '#EC4899' },
  ]

  // AI alert chips — smart warnings based on today's data
  const alertChips = useMemo(() => {
    const chips = []
    const budgetPct = dailyBudget > 0 ? (todaySpend / dailyBudget) * 100 : 0
    if (budgetPct > 80) {
      chips.push({ text: `⚠️ ${Math.round(budgetPct)}% of daily budget used`, color: '#FB7185', to: '/finance' })
    }
    if (wasteMins > (preferences.dailyWasteLimit || 2) * 60) {
      chips.push({ text: `⚠️ ${(wasteMins / 60).toFixed(1)}h waste time (over limit)`, color: '#F59E0B', to: '/timeflow' })
    }
    if (studyMins < studyGoalMins * 0.3 && hour > 15) {
      chips.push({ text: `📚 Only ${(studyMins / 60).toFixed(1)}h studied — ${(studyGoalMins / 60).toFixed(1)}h goal`, color: '#60A5FA', to: '/study' })
    }
    if (completedToday === 0 && checkpoints.length > 0 && hour > 12) {
      chips.push({ text: `✅ No habits done yet today`, color: '#818CF8', to: '/habits' })
    }
    return chips
  }, [todaySpend, dailyBudget, wasteMins, preferences.dailyWasteLimit, studyMins, studyGoalMins, hour, completedToday, checkpoints.length])

  const metrics = useMemo(
    () => [
      {
        icon: '💸',
        label: 'Spent Today',
        value: formatCurrencyAmount(todaySpend, currency),
        sub: `${formatCurrencyAmount(dailyBudget, currency)} daily budget`,
        color: todaySpend > dailyBudget ? '#FB7185' : '#34D399',
        to: '/finance',
        progress: dailyBudget > 0 ? Math.min(100, Math.round((todaySpend / dailyBudget) * 100)) : 0,
        progressColor: todaySpend > dailyBudget ? '#FB7185' : '#34D399',
        invertProgress: true,
      },
      {
        icon: '📚',
        label: 'Study Time',
        value: `${(studyMins / 60).toFixed(1)}h`,
        sub: `${(studyGoalMins / 60).toFixed(1)}h goal`,
        color: '#60A5FA',
        to: '/study',
        progress: studyGoalMins > 0 ? Math.min(100, Math.round((studyMins / studyGoalMins) * 100)) : 0,
        progressColor: '#60A5FA',
      },
      {
        icon: '📱',
        label: 'Waste Time',
        value: `${(wasteMins / 60).toFixed(1)}h`,
        sub: `${preferences.dailyWasteLimit || 2}h limit`,
        color:
          wasteMins > (preferences.dailyWasteLimit || 2) * 60 ? '#FB7185' : '#34D399',
        to: '/timeflow',
        progress: ((preferences.dailyWasteLimit || 2) * 60) > 0 ? Math.min(100, Math.round((wasteMins / ((preferences.dailyWasteLimit || 2) * 60)) * 100)) : 0,
        progressColor: wasteMins > (preferences.dailyWasteLimit || 2) * 60 ? '#FB7185' : '#F59E0B',
        invertProgress: true,
      },
      {
        icon: '🏃',
        label: 'Steps',
        value: animatedSteps.toLocaleString(),
        sub: `${(preferences.dailyStepGoal || 10000).toLocaleString()} goal`,
        color: '#F472B6',
        to: '/health',
        progress: (preferences.dailyStepGoal || 10000) > 0 ? Math.min(100, Math.round(((todayHealth.steps || 0) / (preferences.dailyStepGoal || 10000)) * 100)) : 0,
        progressColor: '#F472B6',
      },
      {
        icon: '🔥',
        label: 'Best Streak',
        value: `${animatedBestStreak} days`,
        sub: 'longest active run',
        color: '#F59E0B',
        to: '/habits',
      },
      {
        icon: '😴',
        label: 'Sleep',
        value: `${(Number(todayHealth.sleepHours) || 0).toFixed(1)}h`,
        sub: `${preferences.sleepGoal || 8}h goal`,
        color: '#A78BFA',
        to: '/health',
        progress: (preferences.sleepGoal || 8) > 0 ? Math.min(100, Math.round(((Number(todayHealth.sleepHours) || 0) / (preferences.sleepGoal || 8)) * 100)) : 0,
        progressColor: '#A78BFA',
      },
      {
        icon: '💧',
        label: 'Water Log',
        value: `${todayWaterTotal} ml`,
        sub: `${waterGoal} ml goal`,
        color: '#60A5FA',
        to: '/health',
        progress: waterGoal > 0 ? Math.min(100, Math.round((todayWaterTotal / waterGoal) * 100)) : 0,
        progressColor: todayWaterTotal >= waterGoal ? '#10B981' : '#60A5FA',
      },
    ],
    [
      todaySpend,
      dailyBudget,
      studyMins,
      studyGoalMins,
      wasteMins,
      preferences.dailyWasteLimit,
      preferences.dailyStepGoal,
      preferences.sleepGoal,
      todayHealth.steps,
      todayHealth.sleepHours,
      bestStreak,
      currency,
      todayWaterTotal,
      waterGoal,
    ]
  )

  // Generate confetti particles once when showing
  const confettiParticles = useMemo(() => {
    const colors = ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#8B5CF6', '#F43F5E', '#14B8A6']
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.5 + Math.random() * 1.2,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 6,
      isCircle: Math.random() > 0.5,
      rotation: Math.random() * 360,
    }))
  }, [showConfetti]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-enter" style={{ padding: '0 0 24px', maxWidth: '1120px', margin: '0 auto', position: 'relative' }}>
      {/* Confetti overlay */}
      {showConfetti && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {confettiParticles.map(p => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.left}%`,
                top: '-12px',
                width: `${p.size}px`,
                height: `${p.size}px`,
                borderRadius: p.isCircle ? '50%' : '2px',
                background: p.color,
                opacity: 1,
                animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}
        </div>
      )}
      <div style={{ padding: isCompactHero ? '20px 16px 10px' : '28px 24px 12px' }}>
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '28px',
            padding: isCompactHero ? '22px' : '28px',
            display: 'grid',
            gridTemplateColumns: isCompactHero ? '1fr' : 'minmax(0, 1.45fr) minmax(220px, 300px)',
            gap: '24px',
            alignItems: 'center',
            background:
              'radial-gradient(circle at top left, rgba(99,102,241,0.16), transparent 30%), rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.14)',
            boxShadow: '0 18px 60px rgba(2,6,23,0.28)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 35%, transparent 65%, rgba(99,102,241,0.05))',
            }}
          />

          <div style={{ position: 'relative', minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 12px',
                borderRadius: '999px',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(129,140,248,0.18)',
                color: '#B9C2FF',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                marginBottom: '16px',
              }}
            >
              <Sparkles size={14} />
              Daily Overview
            </div>

            <h1
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 3.25rem)',
                lineHeight: 1.02,
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.04em',
                maxWidth: '14ch',
              }}
            >
              {greeting}, <span style={{ background: 'linear-gradient(135deg, #6366F1, #EC4899, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{displayName}</span> {greetEmoji}
            </h1>

            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '14px',
                marginTop: '10px',
              }}
            >
              {format(new Date(), 'EEEE, d MMMM yyyy')}
            </p>

            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                lineHeight: 1.7,
                marginTop: '16px',
                maxWidth: '58ch',
              }}
            >
              A clean snapshot of your momentum today — study, spending, habits, health,
              and focus in one place.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '18px',
              }}
            >
              <button
                onClick={() => navigate('/habits')}
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(129,140,248,0.2)',
                  background: 'rgba(99,102,241,0.16)',
                  color: '#E5E7EB',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                Open habits
              </button>

              <button
                onClick={() => navigate('/analytics')}
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                View analytics
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: isCompactHero ? '6px 0 0' : '6px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '280px',
                borderRadius: '24px',
                padding: '18px 16px 14px',
                background: 'rgba(15,23,42,0.36)',
                border: '1px solid rgba(148,163,184,0.12)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                Your score today
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ScoreRing score={animatedScore} size={170} label="Life Score" />
              </div>

              <button
                onClick={() => navigate('/scoring')}
                style={{
                  display: 'block', margin: '6px auto 0', padding: '6px 14px',
                  borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(129,140,248,0.18)',
                  color: '#B9C2FF', cursor: 'pointer',
                }}
              >
                🎯 Customize Score
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                  marginTop: '10px',
                }}
              >
                {scoreBreakdown.map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                        color,
                      }}
                    >
                      {val}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '12px', width: '100%', maxWidth: '280px' }}>
              <XPBar />
            </div>
          </div>
        </section>
      </div>

      <div className="stagger-in" style={{ padding: isCompactHero ? '8px 16px 20px' : '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* AI Alert Chips */}
        {alertChips.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {alertChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => navigate(chip.to)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '999px',
                  background: `${chip.color}14`, border: `1px solid ${chip.color}33`,
                  color: chip.color, fontSize: '12px', fontWeight: 700,
                  cursor: 'pointer', animation: 'fadeSlideIn 0.3s ease',
                }}
              >
                {chip.text}
              </button>
            ))}
          </div>
        )}

        {/* Natural Language Quick Log */}
        <NLInput state={state} setModule={setModule} patchModule={patchModule} showToast={showToast} />

        {/* Quick Energy Check-in Widget */}
        <Card
          style={{
            padding: '16px',
            borderRadius: '20px',
            background: 'rgba(15,23,42,0.48)',
            border: '1px solid rgba(148,163,184,0.10)',
            boxShadow: '0 10px 30px rgba(2,6,23,0.16)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={15} color="#EAB308" /> How is your energy level right now?
            </h3>
            <span
              style={{ fontSize: '11px', color: 'var(--accent-indigo)', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => navigate('/health')}
            >
              View Rhythm 📊
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', width: '100%' }}>
            {[1, 2, 3, 4, 5].map((lvl) => {
              const config = {
                1: { emoji: '😴', label: 'Exhausted', color: '#3B82F6' },
                2: { emoji: '📉', label: 'Tired', color: '#6366F1' },
                3: { emoji: '😐', label: 'Moderate', color: '#F59E0B' },
                4: { emoji: '📈', label: 'High', color: '#EAB308' },
                5: { emoji: '⚡', label: 'Peak', color: '#EF4444' }
              }
              const isSel = energyLevel === lvl
              const conf = config[lvl]
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEnergyLevel(lvl)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '8px 4px',
                    borderRadius: '12px',
                    border: isSel ? `2px solid ${conf.color}` : '1px solid rgba(148,163,184,0.1)',
                    background: isSel ? `${conf.color}15` : 'rgba(30,41,59,0.4)',
                    color: isSel ? conf.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{conf.emoji}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700 }}>{conf.label}</span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'rgba(30,41,59,0.3)',
                border: '1px solid rgba(148,163,184,0.1)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
              placeholder="What are you doing? (e.g. studying, post-meal, workout)"
              value={energyNotes}
              onChange={(e) => setEnergyNotes(e.target.value)}
            />
            <button
              onClick={handleLogEnergy}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'var(--accent-indigo)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Log
            </button>
          </div>
        </Card>

        {/* Smart Reminders */}
        <SmartReminders state={state} />

        {/* ══ AI LIFE COACH BUTTON ══════════════════════ */}
        <div
          onClick={() => { setLifeCoachResult(null); setLifeCoachSaved(false); setShowLifeCoach(true); }}
          style={{
            padding: '18px 20px', borderRadius: '18px', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(236,72,153,0.08), rgba(59,130,246,0.06))',
            border: '1px solid rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 20px rgba(139,92,246,0.08)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(139,92,246,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,92,246,0.08)' }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
            background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
          }}>
            <Brain size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#A78BFA', fontFamily: 'Syne, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🧠 AI Life Coach
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: '1.4' }}>
              Habits • Study • Finance • Wisdom • Goals — Full life analysis with tough love
            </div>
          </div>
          <ArrowRight size={18} color="#A78BFA" />
        </div>

        {/* Weekly Summary Toggle + Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <button
            onClick={() => setShowWeeklySummary(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              alignSelf: 'flex-start',
              padding: '10px 16px',
              borderRadius: '14px',
              border: '1px solid rgba(129,140,248,0.2)',
              background: showWeeklySummary ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)',
              color: '#C7D2FE',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <BarChart3 size={15} />
            {showWeeklySummary ? 'Hide Weekly Summary' : 'View Weekly Summary'}
          </button>

          {showWeeklySummary && <WeeklySummary state={state} />}
        </div>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
            gap: '12px',
          }}
        >
          {metrics.map(({ icon, label, value, sub, color, to, progress, progressColor }) => (
            <Card
              key={label}
              onClick={() => navigate(to)}
              className="metric-card-hover"
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderRadius: '18px',
                background: 'rgba(15,23,42,0.48)',
                border: '1px solid rgba(148,163,184,0.10)',
                boxShadow: '0 10px 30px rgba(2,6,23,0.16)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '22px' }}>{icon}</div>
                {progress !== undefined && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: progress >= 100 ? '#10B981' : 'var(--text-muted)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: progress >= 100 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                  }}>
                    {progress}%
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono, monospace',
                  color,
                  marginTop: '14px',
                }}
              >
                {value}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                {label}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                {sub}
              </div>

              {/* Progress bar */}
              {progress !== undefined && (
                <div style={{
                  height: '4px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                  marginTop: '10px',
                }}>
                  <div style={{
                    width: `${Math.min(100, progress)}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: progressColor || color,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              )}

              {label === 'Water Log' && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                   <button
                     onClick={() => logWaterHome(250)}
                     style={{
                       flex: 1,
                       padding: '5px 8px',
                       borderRadius: '8px',
                       border: '1px solid rgba(59,130,246,0.3)',
                       background: 'rgba(59,130,246,0.1)',
                       color: '#93C5FD',
                       fontSize: '11px',
                       fontWeight: '700',
                       cursor: 'pointer',
                     }}
                   >
                     +250ml
                   </button>
                   <button
                     onClick={() => logWaterHome(500)}
                     style={{
                       flex: 1,
                       padding: '5px 8px',
                       borderRadius: '8px',
                       border: '1px solid rgba(59,130,246,0.3)',
                       background: 'rgba(59,130,246,0.1)',
                       color: '#93C5FD',
                       fontSize: '11px',
                       fontWeight: '700',
                       cursor: 'pointer',
                     }}
                   >
                     +500ml
                   </button>
                </div>
              )}
            </Card>
          ))}
        </section>

        <Card
          style={{
            padding: '18px',
            borderRadius: '20px',
            background: 'rgba(15,23,42,0.48)',
            border: '1px solid rgba(148,163,184,0.10)',
            boxShadow: '0 10px 30px rgba(2,6,23,0.16)',
          }}
        >
          <BadgeGrid />
        </Card>

        {/* ── Today's Timeline Mini-View ────────────────── */}
        {todayTimeEntries.length > 0 && (
          <Card
            style={{
              padding: '16px 18px',
              borderRadius: '18px',
              background: 'rgba(15,23,42,0.48)',
              border: '1px solid rgba(148,163,184,0.10)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⏱️ Today's Timeline
              </h3>
              <button
                onClick={() => navigate('/timeflow')}
                style={{ fontSize: '11px', color: 'var(--accent-indigo)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                View All →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayTimeEntries.slice(0, 4).map((entry, i) => (
                <div
                  key={entry.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: entry.isWaste ? 'rgba(244,63,94,0.06)' : 'rgba(16,185,129,0.04)',
                    border: `1px solid ${entry.isWaste ? 'rgba(244,63,94,0.12)' : 'rgba(148,163,184,0.08)'}`,
                  }}
                >
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: entry.isWaste ? '#FB7185' : '#34D399',
                  }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, flexShrink: 0, minWidth: '42px' }}>
                    {entry.startTime || entry.time || '--:--'}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.activity || entry.category || 'Activity'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>
                    {entry.durationMinutes ? `${entry.durationMinutes}m` : ''}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Today's Journal Preview ──────────────────── */}
        {(() => {
          const todayJournal = (state.journal?.entries || []).find(e => e.date === today)
          if (!todayJournal) return null
          return (
            <Card
              onClick={() => navigate('/journal')}
              className="metric-card-hover"
              style={{
                padding: '16px 18px',
                borderRadius: '18px',
                background: 'rgba(15,23,42,0.48)',
                border: '1px solid rgba(148,163,184,0.10)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px' }}>📝</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {todayJournal.title || 'Journal Entry'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Mood: {'😐😟🙂😊😄'.split(/(?=.)/u)[todayJournal.mood - 1] || '🙂'} {todayJournal.mood}/5
                    {todayJournal.energy ? ` · Energy: ${todayJournal.energy}/5` : ''}
                  </div>
                </div>
                <ArrowRight size={14} color="var(--text-muted)" />
              </div>
              <p style={{
                fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {todayJournal.content?.replace(/[#*>\[\]`]/g, '').slice(0, 200) || 'No content'}
              </p>
            </Card>
          )
        })()}

        {/* ── Weekly Quick Stats Row ───────────────────── */}
        {(() => {
          const last7days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - i)
            return d.toISOString().split('T')[0]
          })
          const weekJournals = (state.journal?.entries || []).filter(e => last7days.includes(e.date)).length
          const weekStudyMins = (state.study?.sessions || [])
            .filter(s => last7days.includes(s.date))
            .reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
          const weekSpend = (state.finance?.expenses || [])
            .filter(e => last7days.includes(e.date))
            .reduce((a, e) => a + (Number(e.amount) || 0), 0)
          const weekHabitDone = (state.habits?.dailyLogs || [])
            .filter(l => last7days.includes(l.date) && l.status === 'done').length

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
            }}>
              {[
                { icon: '📝', label: 'Journals', value: weekJournals, sub: 'this week', color: '#8B5CF6' },
                { icon: '📚', label: 'Study', value: `${(weekStudyMins / 60).toFixed(1)}h`, sub: 'this week', color: '#60A5FA' },
                { icon: '💸', label: 'Spending', value: formatCurrencyAmount(weekSpend, currency), sub: 'this week', color: '#FB7185' },
                { icon: '✅', label: 'Habits Done', value: weekHabitDone, sub: 'this week', color: '#10B981' },
              ].map(stat => (
                <div
                  key={stat.label}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'rgba(15,23,42,0.48)',
                    border: '1px solid rgba(148,163,184,0.08)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '16px', marginBottom: '6px' }}>{stat.icon}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: stat.color }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                    {stat.label} · {stat.sub}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isCompactHero ? '1fr' : 'minmax(0, 1.25fr) minmax(280px, 0.75fr)',
            gap: '18px',
          }}
        >
          <Card
            style={{
              padding: '18px',
              borderRadius: '20px',
              background: 'rgba(15,23,42,0.52)',
              border: '1px solid rgba(148,163,184,0.10)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '18px',
                    margin: 0,
                  }}
                >
                  Today&apos;s Checkpoints
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Finish your essentials and keep the streak alive.
                </p>
              </div>

              <div
                style={{
                  minWidth: '84px',
                  textAlign: 'right',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#C7D2FE',
                  }}
                >
                  {completedToday} / {checkpoints.length}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {completionPct}% done
                </div>
              </div>
            </div>

            <div
              style={{
                height: '8px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: `${completionPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                  borderRadius: '999px',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {checkpoints.length === 0 ? (
                <div
                  style={{
                    padding: '16px 14px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(148,163,184,0.10)',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                  }}
                >
                  No active checkpoints yet.
                </div>
              ) : (
                checkpoints.slice(0, 5).map(cp => {
                  const status = getCheckpointStatus(cp.id)
                  const streak = getStreak(cp.id)
                  const done = status === 'done'

                  return (
                    <button
                      key={cp.id}
                      onClick={() => toggleCheckpoint(cp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: done ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${done ? 'rgba(16,185,129,0.22)' : 'rgba(148,163,184,0.10)'}`,
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '999px',
                          border: `2px solid ${done ? '#10B981' : 'rgba(148,163,184,0.55)'}`,
                          background: done ? '#10B981' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {done && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
                      </div>

                      <span style={{ fontSize: '19px', flexShrink: 0 }}>{cp.icon}</span>

                      <span
                        style={{
                          flex: 1,
                          fontSize: '14px',
                          fontWeight: 600,
                          color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {cp.title}
                      </span>

                      {streak > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#F59E0B',
                            fontWeight: 700,
                          }}
                        >
                          🔥 {streak}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            <button
              onClick={() => navigate('/habits')}
              style={{
                marginTop: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#A5B4FC',
                fontWeight: 700,
              }}
            >
              See all checkpoints <ArrowRight size={14} />
            </button>
          </Card>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <Card
              style={{
                padding: '18px',
                borderRadius: '20px',
                background: 'rgba(15,23,42,0.52)',
                border: '1px solid rgba(148,163,184,0.10)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '12px',
                    background: 'rgba(99,102,241,0.14)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Zap size={16} color="#A5B4FC" />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: '16px',
                    }}
                  >
                    Today&apos;s Insight
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    AI-style summary based on your logs
                  </div>
                </div>
              </div>

              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {aiInsight || fallbackInsight}
              </p>

              <button
                type="button"
                onClick={handleGenerateInsight}
                disabled={aiInsightLoading}
                style={{
                  marginTop: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(129,140,248,0.22)',
                  background: aiInsightLoading ? 'rgba(148,163,184,0.08)' : 'rgba(99,102,241,0.14)',
                  color: '#C7D2FE',
                  cursor: aiInsightLoading ? 'wait' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <Sparkles size={14} />
                {aiInsightLoading ? 'Thinking...' : 'Generate with Gemini'}
              </button>
            </Card>

            <Card
              style={{
                padding: '18px',
                borderRadius: '20px',
                background: 'rgba(15,23,42,0.52)',
                border: '1px solid rgba(148,163,184,0.10)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(148,163,184,0.08)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Focus score</div>
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '20px',
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#60A5FA',
                    }}
                  >
                    {scores.studyScore}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(148,163,184,0.08)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Habit score</div>
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '20px',
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#818CF8',
                    }}
                  >
                    {scores.checkpointScore}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ══ AI LIFE COACH MODAL ══════════════════════ */}
      <Modal isOpen={showLifeCoach} onClose={() => { setShowLifeCoach(false); setLifeCoachResult(null); setLifeCoachSaved(false); }} title="🧠 AI Life Coach — Full Life Analysis">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {!lifeCoachResult ? (
            <>
              <div style={{
                padding: '16px', borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06), rgba(59,130,246,0.04))',
                border: '1px solid rgba(139,92,246,0.2)',
                fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7',
              }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#A78BFA', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Brain size={16} /> What I'll Analyze
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  {['\u2705 Habits & Non-Negotiables', '\ud83d\udcda Study trends (7 days)', '\u23f1\ufe0f Timeline & waste time', '\ud83d\udcb0 Finance & spending', '\ud83d\udcdd Journal mood patterns', '\ud83e\udde0 Your own Wisdoms', '\ud83c\udfaf Goals progress', '\ud83d\udcaa Improvement trends'].map(item => (
                    <div key={item} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item}</div>
                  ))}
                </div>
              </div>
              <Button onClick={runLifeCoach} disabled={lifeCoachLoading}
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: '#fff', padding: '14px', fontSize: '15px', fontWeight: '800' }}>
                {lifeCoachLoading ? '⏳ Analyzing your entire life...' : '🧠 Analyze My Life'}
              </Button>
            </>
          ) : null}

          {lifeCoachResult?.error && (
            <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px', fontSize: '13px', color: '#F43F5E' }}>
              ⚠️ {lifeCoachResult.message}
            </div>
          )}

          {lifeCoachResult && !lifeCoachResult.error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Overall Verdict */}
              <div style={{
                padding: '16px', borderRadius: '14px', textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.08))',
                border: '1px solid rgba(139,92,246,0.25)',
              }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#A78BFA', lineHeight: '1.6' }}>
                  {lifeCoachResult.overallVerdict}
                </div>
              </div>

              {/* Improvement Trend */}
              {lifeCoachResult.improvementTrend && (
                <div style={{
                  padding: '14px', borderRadius: '12px',
                  background: lifeCoachResult.improvementTrend.direction === 'improving' ? 'rgba(16,185,129,0.06)' : lifeCoachResult.improvementTrend.direction === 'declining' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                  border: `1px solid ${lifeCoachResult.improvementTrend.direction === 'improving' ? 'rgba(16,185,129,0.2)' : lifeCoachResult.improvementTrend.direction === 'declining' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px',
                    color: lifeCoachResult.improvementTrend.direction === 'improving' ? '#10B981' : lifeCoachResult.improvementTrend.direction === 'declining' ? '#EF4444' : '#F59E0B',
                  }}>
                    <TrendingUp size={14} /> {lifeCoachResult.improvementTrend.direction === 'improving' ? '📈 Improving' : lifeCoachResult.improvementTrend.direction === 'declining' ? '📉 Declining' : '➡️ Stable'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{lifeCoachResult.improvementTrend.details}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', fontStyle: 'italic', marginTop: '8px',
                    color: lifeCoachResult.improvementTrend.direction === 'improving' ? '#10B981' : '#F59E0B',
                  }}>
                    💪 {lifeCoachResult.improvementTrend.motivationalLine}
                  </div>
                </div>
              )}

              {/* Non-Negotiable Scold */}
              {lifeCoachResult.nonNegotiableScold && (
                <div style={{
                  padding: '14px', borderRadius: '12px',
                  background: lifeCoachResult.nonNegotiableScold.hasMissed ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${lifeCoachResult.nonNegotiableScold.hasMissed ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)'}`,
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px',
                    color: lifeCoachResult.nonNegotiableScold.hasMissed ? '#EF4444' : '#10B981',
                  }}>
                    <Shield size={14} /> {lifeCoachResult.nonNegotiableScold.hasMissed ? '🔒 NON-NEGOTIABLE ALERT!' : '🔒 Non-Negotiables: All Clear!'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', fontWeight: lifeCoachResult.nonNegotiableScold.hasMissed ? '600' : '400' }}>
                    {lifeCoachResult.nonNegotiableScold.message}
                  </div>
                </div>
              )}

              {/* Missed Habits Analysis */}
              {lifeCoachResult.missedHabitsAnalysis?.length > 0 && (
                <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    ❌ Missed Habits — Why They Matter
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {lifeCoachResult.missedHabitsAnalysis.map((h, i) => (
                      <div key={i} style={{
                        padding: '10px', borderRadius: '10px',
                        background: h.isNonNegotiable ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.04)',
                        border: `1px solid ${h.isNonNegotiable ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)'}`,
                      }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {h.habitName}
                          {h.isNonNegotiable && <span style={{ fontSize: '10px', fontWeight: '800', color: '#EF4444', background: 'rgba(239,68,68,0.12)', padding: '1px 6px', borderRadius: '4px' }}>🔒</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{h.whyItMatters}</div>
                        <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', marginTop: '4px' }}>💡 {h.suggestion}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wisdom Reminders */}
              {lifeCoachResult.wisdomReminders?.length > 0 && (
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={14} /> 📚 Your Own Wisdoms — Follow These Today
                  </div>
                  {lifeCoachResult.wisdomReminders.map((w, i) => (
                    <div key={i} style={{ marginBottom: '10px', padding: '10px', borderRadius: '8px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#A78BFA', fontStyle: 'italic' }}>"✨ {w.wisdom}"</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>→ {w.howToApplyToday}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Study Coaching */}
              {lifeCoachResult.studyCoaching && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>📚 Study Coaching</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    <strong>Status:</strong> {lifeCoachResult.studyCoaching.currentStatus}<br />
                    <strong>Trend:</strong> {lifeCoachResult.studyCoaching.trendAnalysis}<br />
                    <strong>Today's Target:</strong> {lifeCoachResult.studyCoaching.todayTarget}
                  </div>
                </div>
              )}

              {/* Finance Check */}
              {lifeCoachResult.financeCheck && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>💰 Finance Check</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {lifeCoachResult.financeCheck.status}<br />
                    💡 {lifeCoachResult.financeCheck.tip}
                  </div>
                </div>
              )}

              {/* Top Priorities */}
              {lifeCoachResult.topPriorities?.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Target size={14} /> 🎯 Top Priorities — Rest of Today
                  </div>
                  {lifeCoachResult.topPriorities.map((p, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>{i + 1}. {p}</div>
                  ))}
                </div>
              )}

              {/* Closing Message */}
              {lifeCoachResult.closingMessage && (
                <div style={{
                  padding: '14px', borderRadius: '12px', textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.08))',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}>
                  <div style={{ fontSize: '14px', color: '#A78BFA', fontWeight: '800', lineHeight: '1.6' }}>
                    🚀 {lifeCoachResult.closingMessage}
                  </div>
                </div>
              )}

              {/* Saved indicator */}
              {lifeCoachSaved && (
                <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', textAlign: 'center' }}>
                  💾 Auto-saved to Journal as "AI Life Coach" entry ✓
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button onClick={() => { setShowLifeCoach(false); setLifeCoachResult(null); }} style={{ flex: 1 }}>Done</Button>
                <Button variant="secondary" onClick={() => saveLifeCoachToJournal(lifeCoachResult)} disabled={!lifeCoachResult || lifeCoachResult.error}>
                  💾 Save to Journal
                </Button>
                <Button variant="secondary" onClick={runLifeCoach}>
                  Re-analyze
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        {fabOpen &&
          fabActions.map(({ icon, label, action }) => (
            <button
              key={label}
              onClick={() => {
                action()
                setFabOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(15,23,42,0.88)',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: '14px',
                padding: '11px 16px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                boxShadow: '0 10px 30px rgba(2,6,23,0.35)',
                animation: 'fadeInUp 0.18s ease',
              }}
            >
              <span style={{ fontSize: '18px' }}>{icon}</span>
              {label}
            </button>
          ))}

        <button
          onClick={() => setFabOpen(o => !o)}
          aria-label="Quick add"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px rgba(99,102,241,0.45)',
            transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.22s ease',
          }}
        >
          <Plus size={24} color="#fff" />
        </button>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
