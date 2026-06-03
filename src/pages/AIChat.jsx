


import { useMemo, useState, useEffect, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { Send, Sparkles, Bot, User, Trash2, Sun, Zap, Volume2 } from 'lucide-react'
import { useAppActions, useAppState } from '../context/appHooks'
import { getGeminiApiKey } from '../services/geminiService'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { getCurrencySymbol, normalizeCurrency } from '../utils/currency'
import { playSuccessSound, playNoticeChime, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticMedium, hapticWarning } from '../hooks/useHaptic'
import { useToast } from '../context/toastContextCore'

/* ── tone definitions ─────────────────────────────────────────────── */

const COACH_TONES = [
  { key: 'gentle',        label: 'Gentle 🤗' },
  { key: 'balanced',      label: 'Balanced ⚖️' },
  { key: 'tough_love',    label: 'Tough Love 💪' },
  { key: 'drill_sergeant', label: 'Drill Sergeant 🎖️' },
]

const TONE_SYSTEM_PROMPTS = {
  gentle: `Your coaching style is GENTLE and supportive.
- Celebrate every small win the user has achieved.
- Use warm, encouraging language.
- When pointing out areas to improve, frame them as "opportunities" and always lead with what the user did well first.
- End responses with an uplifting note.`,

  balanced: `Your coaching style is BALANCED — honest with positivity.
- Acknowledge successes factually, then move to constructive feedback.
- Be straightforward but kind.
- Offer specific, practical advice alongside praise.`,

  tough_love: `Your coaching style is TOUGH LOVE — brutally honest about failures.
- Call out missed targets and slipping trends directly. Do NOT sugarcoat.
- For every callout, immediately provide ONE concrete next action.
- Acknowledge real effort only — do not give hollow praise.`,

  drill_sergeant: `Your coaching style is DRILL SERGEANT — no-nonsense, direct orders.
- Speak in short, commanding sentences.
- When goals are missed, express clear disappointment.
- Give direct orders for what to do next ("Do X. Now.").
- Only acknowledge success with brief approval ("Good. Next objective:").
- Do NOT use pleasantries or small talk.`,
}

/* ── data helpers ──────────────────────────────────────────────────── */

function getLast30DaysSummary(state) {
  const expenses = state.finance?.expenses || []
  const studySessions = state.study?.sessions || []
  const timeEntries = state.timeflow?.entries || []
  const checkpoints = state.habits?.checkpoints || []
  const habitLogs = state.habits?.dailyLogs || []
  const healthLogs = state.health?.manualLogs || []
  const journalEntries = state.journal?.entries || []

  const cutoff = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  const last30Expenses = expenses.filter(e => e.date >= cutoff)
  const last30Study = studySessions.filter(s => s.date >= cutoff)
  const last30Time = timeEntries.filter(t => t.date >= cutoff)
  const last30Health = healthLogs.filter(h => h.date >= cutoff)
  const last30Journal = journalEntries.filter(j => j.date >= cutoff)
  const last30HabitLogs = habitLogs.filter(h => h.date >= cutoff)

  const totalSpend = last30Expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)

  const spendByCategory = {}
  last30Expenses.forEach(e => {
    const cat = e.category || 'Other'
    spendByCategory[cat] = (spendByCategory[cat] || 0) + (Number(e.amount) || 0)
  })

  const totalStudyMinutes = last30Study.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)

  const subjectHours = {}
  last30Study.forEach(s => {
    const sub = s.subject || 'Other'
    subjectHours[sub] = (subjectHours[sub] || 0) + (Number(s.durationMinutes) || 0) / 60
  })

  const wasteMinutes = last30Time
    .filter(t => t.isWaste)
    .reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0)

  const productiveMinutes = last30Time
    .filter(t => !t.isWaste)
    .reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0)

  const completedHabitLogs = last30HabitLogs.filter(log => log.status === 'done').length
  const possibleHabitLogs = last30HabitLogs.length || checkpoints.length * 30

  const stepLogs = last30Health.filter(h => h.steps)
  const sleepLogs = last30Health.filter(h => h.sleepHours)
  const moodLogs = last30Journal.filter(j => j.mood)

  const avgSteps = stepLogs.length
    ? Math.round(stepLogs.reduce((a, h) => a + (Number(h.steps) || 0), 0) / stepLogs.length)
    : null

  const avgSleep = sleepLogs.length
    ? +(sleepLogs.reduce((a, h) => a + (Number(h.sleepHours) || 0), 0) / sleepLogs.length).toFixed(1)
    : null

  const avgMood = moodLogs.length
    ? +(moodLogs.reduce((a, j) => a + (Number(j.mood) || 0), 0) / moodLogs.length).toFixed(1)
    : null

  return {
    finance: {
      totalSpend: Math.round(totalSpend),
      transactionCount: last30Expenses.length,
      topCategories: Object.entries(spendByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    },
    study: {
      totalHours: +(totalStudyMinutes / 60).toFixed(1),
      sessionCount: last30Study.length,
      subjects: Object.entries(subjectHours)
        .map(([subject, hours]) => ({ subject, hours: +hours.toFixed(1) }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 6),
    },
    timeflow: {
      productiveHours: +(productiveMinutes / 60).toFixed(1),
      wasteHours: +(wasteMinutes / 60).toFixed(1),
      entryCount: last30Time.length,
    },
    habits: {
      completionRate: possibleHabitLogs
        ? Math.round((completedHabitLogs / possibleHabitLogs) * 100)
        : 0,
      activeHabits: checkpoints.length,
    },
    health: {
      avgSteps,
      avgSleep,
      logCount: last30Health.length,
    },
    journal: {
      avgMood,
      entryCount: last30Journal.length,
    },
  }
}

/* ── 7-day trend helper ───────────────────────────────────────────── */

function getLast7DaysTrend(state) {
  const expenses = state.finance?.expenses || []
  const studySessions = state.study?.sessions || []
  const timeEntries = state.timeflow?.entries || []
  const habitLogs = state.habits?.dailyLogs || []
  const checkpoints = state.habits?.checkpoints || []

  const days = []
  for (let i = 6; i >= 0; i--) {
    const dateKey = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const dayExpenses = expenses.filter(e => e.date === dateKey)
    const dayStudy = studySessions.filter(s => s.date === dateKey)
    const dayTime = timeEntries.filter(t => t.date === dateKey)
    const dayHabitLogs = habitLogs.filter(h => h.date === dateKey)

    const spent = dayExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)
    const studyMins = dayStudy.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
    const productiveMins = dayTime.filter(t => !t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0)
    const wasteMins = dayTime.filter(t => t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0)
    const habitsDone = dayHabitLogs.filter(l => l.status === 'done').length
    const habitsTotal = checkpoints.length

    days.push({
      date: dateKey,
      spent: Math.round(spent),
      studyHours: +(studyMins / 60).toFixed(1),
      productiveHours: +(productiveMins / 60).toFixed(1),
      wasteHours: +(wasteMins / 60).toFixed(1),
      habitsCompleted: habitsDone,
      habitsTotal,
    })
  }
  return days
}

/* ── today's briefing data ────────────────────────────────────────── */

function getTodayBriefingData(state) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const preferences = state.settings?.preferences || {}
  const monthlyBudget = preferences.monthlyBudget ?? 15000

  const expenses = state.finance?.expenses || []
  const currentMonth = format(new Date(), 'yyyy-MM')
  const monthExpenses = expenses.filter(e => e.date?.startsWith(currentMonth))
  const monthSpent = monthExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)
  const budgetLeft = Math.max(0, monthlyBudget - monthSpent)

  const checkpoints = state.habits?.checkpoints || []
  const habitLogs = state.habits?.dailyLogs || []
  const todayLogs = habitLogs.filter(h => h.date === today)
  const habitsDone = todayLogs.filter(l => l.status === 'done').length
  const habitsPending = checkpoints.length - habitsDone

  const studySessions = state.study?.sessions || []
  const todayStudy = studySessions.filter(s => s.date === today)
  const studyHours = +(todayStudy.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0) / 60).toFixed(1)

  const timeEntries = state.timeflow?.entries || []
  const todayTime = timeEntries.filter(t => t.date === today)
  const productiveHours = +(todayTime.filter(t => !t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60).toFixed(1)

  return { budgetLeft, habitsPending, habitsTotal: checkpoints.length, studyHours, productiveHours }
}

/* ── prompt building ──────────────────────────────────────────────── */

const GREETINGS = ['hi', 'hello', 'hey', 'hii', 'namaste', 'hola']

function isGreeting(text) {
  return GREETINGS.includes(text.trim().toLowerCase())
}

function isDataQuestion(text) {
  const q = text.trim().toLowerCase()
  return (
    q.includes('?') ||
    /how much|average|when|which|what|who|best|worst|trend|compare|spend|study|sleep|habit|waste|steps|mood|journal|time|briefing|plan|morning|today|log|add|track|delete|record|remove|spent|toggle|workout|gym|calories|protein|food|weight/i.test(q)
  )
}

function buildGeminiPrompt(question, summary, tone, scoreWeights, trend7Days, categories) {
  const tonePrompt = TONE_SYSTEM_PROMPTS[tone] || TONE_SYSTEM_PROMPTS.balanced

  const weightsBlock = scoreWeights
    ? `\nUSER'S CUSTOM SCORE WEIGHTS:\n${JSON.stringify(scoreWeights, null, 2)}`
    : ''

  const categoriesBlock = categories
    ? `\nAPP CATEGORIES:\n${JSON.stringify(categories, null, 2)}`
    : ''

  return `
You are a personal life analytics coach inside Life OS.

${tonePrompt}

Core rules (apply to ALL tones):
- Answer ONLY the user's question.
- Use ONLY the provided data summary and trends.
- Be specific, concise, and practical.
- If the data is insufficient, say so clearly.
- Do NOT mention policies or that you are an AI.
- Do NOT invent numbers.
- If the user just greets or says something non-question, reply briefly and friendly.
- Always pair criticism with one concrete next step.
- Be honest about behavior and data, never about the person's worth.

APP-CONTROL TOOL CALLS (CRITICAL ACTION RULE):
If the user commands you to log, add, track, delete, or record a task or metric, you MUST respond conversationally and ALSO append a valid JSON action block enclosed in "<action>" and "</action>" tags at the end of your response.
Supported actions are:
1. Add Expense:
   <action>{"action": "add_expense", "amount": number, "description": "string", "category": "Food & Drinks" | "Groceries" | "Transport" | "Gym & Fitness" | "Study & Education" | "Shopping" | "Bills & Utilities" | "Entertainment" | "Subscriptions" | "Personal Care" | "Miscellaneous", "paymentMethod": "UPI" | "Cash" | "Card" | "Net Banking", "date": "YYYY-MM-DD"}</action>
2. Log Study Session:
   <action>{"action": "add_study", "subject": "string", "topic": "string", "durationMinutes": number, "date": "YYYY-MM-DD"}</action>
3. Log Time Flow Activity:
   <action>{"action": "add_timeflow", "activity": "string", "durationMinutes": number, "category": "string", "isWaste": boolean, "date": "YYYY-MM-DD"}</action>
4. Log Health Metrics:
   <action>{"action": "log_health", "steps": number, "sleepHours": number, "weight": number, "date": "YYYY-MM-DD"}</action>
5. Add Journal Entry:
   <action>{"action": "add_journal", "title": "string", "content": "string", "mood": number(1-5), "date": "YYYY-MM-DD"}</action>
6. Toggle Checkpoint/Habit:
   <action>{"action": "toggle_habit", "title": "string" (matching habit name), "status": "done" | "undone", "date": "YYYY-MM-DD"}</action>

Always use today's date (${format(new Date(), 'yyyy-MM-dd')}) if no specific date is mentioned in their request.
${weightsBlock}
${categoriesBlock}

LAST 7 DAYS TREND (day-by-day):
${JSON.stringify(trend7Days, null, 2)}

30-DAY DATA SUMMARY:
${JSON.stringify(summary, null, 2)}

USER QUESTION:
${question}
`
}


async function askGemini(question, summary, tone, scoreWeights, trend7Days, categories) {
  const apiKey = getGeminiApiKey()

  if (!apiKey) return null

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildGeminiPrompt(question, summary, tone, scoreWeights, trend7Days, categories) }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600,
        },
      }),
    }
  )

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Gemini request failed')
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || ''

  return text || null
}

function executeAIAction(action, state, setModule, patchModule, showToast) {
  if (!action || !action.action) return false

  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const date = action.date || today

    if (action.action === 'add_expense') {
      const amount = Number(action.amount)
      if (isNaN(amount) || amount <= 0) return false

      const newExpense = {
        id: crypto.randomUUID(),
        amount,
        currency: state.settings?.profile?.currency || 'INR',
        category: action.category || 'Other',
        subcategory: action.subcategory || '',
        description: action.description || 'Logged via AI Chat',
        date,
        time: format(new Date(), 'HH:mm'),
        paymentMethod: action.paymentMethod || 'UPI',
        isImpulsive: !!action.isImpulsive,
        account: action.account || 'Cash',
        isRecurring: false,
        tags: action.tags || [],
        billDriveFileId: null,
        billOCRText: null,
        createdAt: new Date().toISOString()
      }

      const currentExpenses = state.finance?.expenses || []
      setModule('finance', {
        ...state.finance,
        expenses: [newExpense, ...currentExpenses]
      })

      showToast(`✅ Logged ${state.settings?.profile?.currency || 'INR'} ${amount} for ${newExpense.description}`, 'success')
      playSuccessSound()
      hapticSuccess()
      return true
    }

    if (action.action === 'add_study') {
      const durationMinutes = Number(action.durationMinutes)
      if (isNaN(durationMinutes) || durationMinutes <= 0) return false

      const newSession = {
        id: crypto.randomUUID(),
        date,
        subject: action.subject || 'Other',
        topic: action.topic || 'Logged via AI Chat',
        focusType: 'Deep Focus',
        durationMinutes,
        notes: action.notes || '',
        rating: action.rating || 3,
        pagesRead: Number(action.pagesRead) || 0,
        problemsSolved: Number(action.problemsSolved) || 0,
        source: 'manual',
        createdAt: new Date().toISOString(),
      }

      const sessions = state.study?.sessions || []
      setModule('study', { ...state.study, sessions: [newSession, ...sessions] })

      showToast(`✅ Logged ${(durationMinutes / 60).toFixed(1)}h study: ${newSession.subject}`, 'success')
      playSuccessSound()
      hapticSuccess()
      return true
    }

    if (action.action === 'add_timeflow') {
      const durationMinutes = Number(action.durationMinutes)
      if (isNaN(durationMinutes) || durationMinutes <= 0) return false

      const activity = action.activity || action.category || 'Activity'
      const category = action.category || 'Other'
      const start = action.start || '12:00'
      const [sh, sm] = start.split(':').map(Number)
      let eh = sh + Math.floor((sm + durationMinutes) / 60)
      let em = (sm + durationMinutes) % 60
      const end = `${String(eh % 24).padStart(2, '0')}:${String(em).padStart(2, '0')}`

      const payload = {
        date,
        start,
        end,
        durationMinutes,
        name: activity,
        category,
        productivityScore: action.productivityScore || 3,
        mood: action.mood || 3,
        isWaste: !!action.isWaste,
        isBadHabit: !!action.isWaste,
        notes: action.notes || '',
        tags: action.tags || [],
        source: 'manual',
        updatedAt: new Date().toISOString(),
        studySessionId: null
      }

      // Sync to Study
      if (category === 'Study') {
        const studySubjects = state.study?.subjects?.length 
          ? state.study.subjects 
          : ['Mathematics', 'Physics', 'CS Theory', 'Machine Learning', 'Deep Learning', 'DSA', 'Research Paper', 'Project Work', 'GATE Prep', 'Other']
        
        const cleanName = activity.replace(/^(?:study|studied|learning|learnt|read):\s*/i, '').trim()
        const matchedSubject = studySubjects.find(s => cleanName.toLowerCase().includes(s.toLowerCase()))
        
        const sessionSubject = matchedSubject || studySubjects[0] || 'Other'
        const sessionTopic = matchedSubject ? cleanName.replace(new RegExp(matchedSubject, 'i'), '').replace(/^[\s—\-•:]+/, '').trim() : cleanName

        const studySessions = state.study?.sessions || []
        const studySessionId = crypto.randomUUID()
        const newSession = {
          id: studySessionId,
          date,
          subject: sessionSubject,
          topic: sessionTopic || 'Logged via TimeFlow',
          focusType: 'Deep Focus',
          durationMinutes,
          notes: action.notes || '',
          rating: payload.productivityScore,
          source: 'timeflow-sync',
          createdAt: new Date().toISOString(),
        }
        payload.studySessionId = studySessionId
        setModule('study', { ...state.study, sessions: [newSession, ...studySessions] })
      }

      const allEntries = state.timeflow?.entries || []
      const newEntry = { id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() }
      setModule('timeflow', { ...state.timeflow, entries: [...allEntries, newEntry] })

      showToast(`✅ Logged ${(durationMinutes / 60).toFixed(1)}h activity: ${activity}`, 'success')
      playSuccessSound()
      hapticSuccess()
      return true
    }

    if (action.action === 'log_health') {
      const bodyLogs = state.health?.bodyLogs || []
      const existing = bodyLogs.find(l => l.date === date)
      
      const updateData = {}
      if (action.steps !== undefined && action.steps !== null) updateData.steps = Number(action.steps)
      if (action.sleepHours !== undefined && action.sleepHours !== null) updateData.sleepHours = Number(action.sleepHours)
      if (action.weight !== undefined && action.weight !== null) updateData.weight = Number(action.weight)

      if (Object.keys(updateData).length === 0) return false

      let updatedLogs
      if (existing) {
        updatedLogs = bodyLogs.map(l =>
          l.date === date ? { ...l, ...updateData, updatedAt: new Date().toISOString() } : l
        )
      } else {
        const newLog = {
          id: crypto.randomUUID(),
          date,
          ...updateData,
          source: 'manual',
          createdAt: new Date().toISOString()
        }
        updatedLogs = [...bodyLogs, newLog]
      }

      patchModule('health', { bodyLogs: updatedLogs })
      
      const loggedDetails = []
      if (updateData.steps !== undefined) loggedDetails.push(`${updateData.steps.toLocaleString()} steps`)
      if (updateData.sleepHours !== undefined) loggedDetails.push(`${updateData.sleepHours}h sleep`)
      if (updateData.weight !== undefined) loggedDetails.push(`${updateData.weight}kg`)
      
      showToast(`✅ Logged: ${loggedDetails.join(', ')}`, 'success')
      playSuccessSound()
      hapticSuccess()
      return true
    }

    if (action.action === 'add_journal') {
      const payload = {
        title: action.title || 'Untitled Entry',
        content: action.content || '',
        mood: Number(action.mood) || 3,
        energy: Number(action.energy) || 3,
        gratitude: action.gratitude || '',
        tags: action.tags || [],
        updatedAt: new Date().toISOString(),
      }

      const newEntry = {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: new Date().toISOString(),
        date
      }

      const entries = state.journal?.entries || []
      setModule('journal', {
        ...state.journal,
        entries: [newEntry, ...entries],
      })

      showToast('✅ Saved journal entry ✓', 'success')
      playSuccessSound()
      hapticSuccess()
      return true
    }

    if (action.action === 'toggle_habit') {
      const title = action.title
      if (!title) return false

      const checkpoints = state.habits?.checkpoints || []
      const habit = checkpoints.find(h => {
        const name = (h.title || h.name || '').toLowerCase()
        return name.includes(title.toLowerCase())
      })

      if (!habit) {
        showToast(`❌ Habit "${title}" not found`, 'error')
        playWarningBeep()
        hapticWarning()
        return false
      }

      const habitId = habit.id
      const dailyLogs = state.habits?.dailyLogs || []
      const existingIndex = dailyLogs.findIndex(log => log.checkpointId === habitId && log.date === date)
      let nextLogs

      if (existingIndex >= 0) {
        const existing = dailyLogs[existingIndex]
        if (action.status === 'undone' || (action.status === undefined && existing.status === 'done')) {
          nextLogs = dailyLogs.filter((_, idx) => idx !== existingIndex)
        } else {
          nextLogs = dailyLogs.map((log, idx) =>
            idx === existingIndex
              ? { ...log, status: 'done', loggedAt: new Date().toISOString() }
              : log
          )
        }
      } else {
        if (action.status === 'undone') {
          nextLogs = dailyLogs
        } else {
          nextLogs = [
            ...dailyLogs,
            {
              id: crypto.randomUUID(),
              checkpointId: habitId,
              date,
              status: 'done',
              value: null,
              note: '',
              loggedAt: new Date().toISOString(),
            },
          ]
        }
      }

      setModule('habits', {
        ...state.habits,
        dailyLogs: nextLogs,
      })

      const isDone = nextLogs.some(log => log.checkpointId === habitId && log.date === date && log.status === 'done')
      showToast(`✅ ${isDone ? 'Completed' : 'Reset'} habit: ${habit.title || habit.name}`, 'success')
      playSuccessSound()
      hapticSuccess()
      return true
    }

    return false
  } catch (err) {
    console.error('Error executing AI action:', err)
    showToast(`❌ Action error: ${err.message}`, 'error')
    playWarningBeep()
    hapticWarning()
    return false
  }
}

const STARTERS = [
  'How much did I spend last month?',
  'How much waste time did I log?',
  'What are my top study subjects?',
  'What is my habit completion rate?',
  'How is my sleep doing lately?',
]

/* ── component ────────────────────────────────────────────────────── */

export default function AIChat() {
  const state = useAppState()
  const { patchModule, setModule } = useAppActions()
  const { showToast } = useToast()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const messages = state.aiChat?.messages || []
  const summary = useMemo(() => getLast30DaysSummary(state), [state])
  const trend7Days = useMemo(() => getLast7DaysTrend(state), [state])
  const briefingData = useMemo(() => getTodayBriefingData(state), [state])
  const currencySymbol = getCurrencySymbol(normalizeCurrency(state.settings?.profile?.currency))

  const preferences = state.settings?.preferences || {}
  const coachTone = preferences.aiCoachTone || 'balanced'
  const scoreWeights = preferences.scoreWeights || null

  function setCoachTone(tone) {
    const settings = state.settings || {}
    const prefs = settings.preferences || {}
    patchModule('settings', {
      ...settings,
      preferences: { ...prefs, aiCoachTone: tone },
    })
  }

  async function sendMessage(text) {
    const question = (text || input).trim()
    if (!question || loading) return

    const currentMessages = state.aiChat?.messages || []

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    }

    if (isGreeting(question)) {
      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Hey! Ask me something about your data, like spending, study, sleep, habits, or journal trends.',
        createdAt: new Date().toISOString(),
      }

      patchModule('aiChat', { messages: [...currentMessages, userMsg, aiMsg] })
      setInput('')
      return
    }

    if (!isDataQuestion(question)) {
      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'I can help with questions about your own data. Try asking things like "What did I spend most on?" or "How much did I study this week?"',
        createdAt: new Date().toISOString(),
      }

      patchModule('aiChat', { messages: [...currentMessages, userMsg, aiMsg] })
      setInput('')
      return
    }

    setLoading(true)
    patchModule('aiChat', { messages: [...currentMessages, userMsg] })

    const categories = {
      expense: state.settings?.preferences?.expenseCategories || [],
      time: state.settings?.preferences?.timeCategories || [],
      study: state.study?.subjects || []
    }

    try {
      const reply = await askGemini(question, summary, coachTone, scoreWeights, trend7Days, categories)

      let cleanReply = reply || ''
      let actionObj = null

      const actionMatch = cleanReply.match(/<action>([\s\S]*?)<\/action>/)
      if (actionMatch) {
        try {
          actionObj = JSON.parse(actionMatch[1].trim())
          cleanReply = cleanReply.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
        } catch (e) {
          console.error('Failed to parse AI action JSON:', e)
        }
      }

      if (actionObj) {
        executeAIAction(actionObj, state, setModule, patchModule, showToast)
      }

      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          cleanReply ||
          `Here is your 30-day snapshot: ${currencySymbol}${summary.finance.totalSpend} spent, ${summary.study.totalHours} study hours, ${summary.timeflow.productiveHours} productive hours, ${summary.timeflow.wasteHours} waste hours, ${summary.habits.completionRate}% habit completion, average sleep ${summary.health.avgSleep ?? 'N/A'} hours, and average journal rating ${summary.journal.avgMood ?? 'N/A'}/5.`,
        createdAt: new Date().toISOString(),
      }

      const latestMessages = state.aiChat?.messages || []
      const hasUserMsg = latestMessages.some(m => m.id === userMsg.id)

      patchModule('aiChat', {
        messages: hasUserMsg
          ? [...latestMessages, aiMsg]
          : [...latestMessages, userMsg, aiMsg],
      })
    } catch (error) {
      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Gemini request failed: ${error.message}`,
        createdAt: new Date().toISOString(),
      }

      const latestMessages = state.aiChat?.messages || []
      const hasUserMsg = latestMessages.some(m => m.id === userMsg.id)

      patchModule('aiChat', {
        messages: hasUserMsg
          ? [...latestMessages, aiMsg]
          : [...latestMessages, userMsg, aiMsg],
      })
    } finally {
      setLoading(false)
      setInput('')
    }
  }

  function clearChat() {
    if (!window.confirm('Clear all chat messages?')) return
    patchModule('aiChat', { messages: [] })
  }

  function requestDailyBriefing() {
    const prompt = `Give me my personalized daily briefing and morning plan for today. Here's what I have so far today: ${currencySymbol}${Math.round(briefingData.budgetLeft)} budget remaining this month, ${briefingData.habitsPending} of ${briefingData.habitsTotal} habits still pending, ${briefingData.studyHours} study hours logged, and ${briefingData.productiveHours} productive hours tracked. Based on my last 7 days trend and 30-day data, create a specific action plan for today with priorities.`
    sendMessage(prompt)
  }

  return (
    <div
      style={{
        maxWidth: '980px',
        margin: '0 auto',
        height: 'calc(100vh - 88px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '20px 24px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: '800',
              fontSize: '1.4rem',
              margin: 0,
            }}
          >
            🤖 AI Chat
          </h1>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Ask questions about your finance, study, health, habits, time flow, and journal data.
          </div>
        </div>

        <Button variant="secondary" onClick={clearChat}>
          <Trash2 size={14} /> Clear
        </Button>
      </div>

      {/* ── Coach Persona Selector ───────────────────────────────── */}
      <div style={{ padding: '12px 24px 0' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginRight: '4px',
            }}
          >
            Coach Tone
          </span>
          {COACH_TONES.map(tone => {
            const isActive = coachTone === tone.key
            return (
              <button
                key={tone.key}
                onClick={() => setCoachTone(tone.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  border: `1px solid ${isActive ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
                  color: isActive ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: isActive ? '700' : '500',
                  transition: 'all 0.15s ease',
                }}
              >
                {tone.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '16px 24px 0' }}>
        <Card>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Spend</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#10B981',
                }}
              >
                {currencySymbol}{summary.finance.totalSpend}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Study</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#3B82F6',
                }}
              >
                {summary.study.totalHours}h
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Habits</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#6366F1',
                }}
              >
                {summary.habits.completionRate}%
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div
        style={{
          padding: '16px 24px 0',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {STARTERS.map(starter => (
          <button
            key={starter}
            onClick={() => sendMessage(starter)}
            style={{
              padding: '8px 12px',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <Sparkles
              size={12}
              style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }}
            />
            {starter}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* ── Daily Briefing Card (shown when chat is empty) ─────── */}
        {messages.length === 0 && (
          <Card>
            <div style={{ padding: '8px 4px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    background: 'rgba(251,191,36,0.12)',
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid rgba(251,191,36,0.25)',
                  }}
                >
                  <Sun size={18} style={{ color: '#FBBF24' }} />
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: '800',
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Today's Snapshot
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginTop: '1px',
                    }}
                  >
                    {format(new Date(), 'EEEE, MMMM d')}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Budget Left
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#10B981',
                      marginTop: '4px',
                    }}
                  >
                    {currencySymbol}{Math.round(briefingData.budgetLeft).toLocaleString()}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Habits Pending
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: briefingData.habitsPending > 0 ? '#F59E0B' : '#10B981',
                      marginTop: '4px',
                    }}
                  >
                    {briefingData.habitsPending}/{briefingData.habitsTotal}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Study Hours
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#3B82F6',
                      marginTop: '4px',
                    }}
                  >
                    {briefingData.studyHours}h
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Productive Hours
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#8B5CF6',
                      marginTop: '4px',
                    }}
                  >
                    {briefingData.productiveHours}h
                  </div>
                </div>
              </div>

              <button
                onClick={requestDailyBriefing}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  color: '#fff',
                  cursor: loading ? 'wait' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '700',
                  fontFamily: 'DM Sans, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <Zap size={16} />
                Get My Daily Briefing
              </button>
            </div>
          </Card>
        )}

        {messages.length === 0 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '44px 20px' }}>
              <div style={{ fontSize: '42px', marginBottom: '10px' }}>💬</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                No messages yet
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ask something like "What did I spend most on?" or "How much did I study this month?"
              </div>
            </div>
          </Card>
        )}

        {messages.length > 0 &&
          messages.map(msg => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  background: isUser ? 'var(--accent-indigo)' : 'var(--bg-card)',
                  color: isUser ? '#fff' : 'var(--text-primary)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                    fontSize: '12px',
                    opacity: 0.9,
                  }}
                >
                  {isUser ? <User size={13} /> : <Bot size={13} />}
                  <span>{isUser ? 'You' : 'Life OS AI'}</span>
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )
          })}

        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '78%',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '6px' }}>
              Life OS AI
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Thinking...</div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '10px',
          }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask about your data..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'DM Sans, sans-serif',
            }}
          />

          <button
            disabled={loading}
            onClick={() => sendMessage()}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              background: loading ? 'var(--text-muted)' : 'var(--accent-indigo)',
              color: '#fff',
              cursor: loading ? 'wait' : 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
