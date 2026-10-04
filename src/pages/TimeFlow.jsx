import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppActions, useAppState } from '../context/appHooks'
import { subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from 'recharts'
import { Plus, Pencil, Mic, MicOff, MessageSquare, Send, Zap, Target, Sparkles, TrendingUp, Camera, ImageIcon, Copy, Check, Upload } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import TagInput from '../components/ui/TagInput'
import { useToast } from '../context/toastContextCore'
import { getGeminiApiKey } from '../services/geminiService'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'

const CATEGORY_COLORS = {
  'Sleep': '#8B5CF6',
  'Morning Routine': '#F59E0B',
  'Exercise': '#10B981',
  'Study': '#3B82F6',
  'Deep Work': '#1D4ED8',
  'Meals': '#F97316',
  'Social Media': '#EF4444',
  'Entertainment': '#EC4899',
  'Travel': '#06B6D4',
  'Self-Care': '#84CC16',
  'Waste Time': '#DC2626',
  'Other': '#6B7280',
}

const WASTE_CATEGORIES = ['Social Media', 'Waste Time', 'Entertainment']
const EMPTY_ARRAY = []

// ── Time-of-Day Theme ─────────────────────────────────────
function getTimeTheme(hour) {
  if (hour >= 5 && hour < 12) return {
    label: 'Good Morning',
    emoji: '🌅',
    colors: ['#F59E0B', '#FCD34D'],
    glow: 'rgba(245,158,11,0.4)',
    gradient: 'radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.15) 0%, transparent 70%)',
    orbColor1: 'rgba(252,211,77,0.12)',
    orbColor2: 'rgba(245,158,11,0.08)',
  }
  if (hour >= 12 && hour < 17) return {
    label: 'Good Afternoon',
    emoji: '☀️',
    colors: ['#3B82F6', '#06B6D4'],
    glow: 'rgba(59,130,246,0.4)',
    gradient: 'radial-gradient(ellipse at 50% 40%, rgba(59,130,246,0.12) 0%, transparent 70%)',
    orbColor1: 'rgba(6,182,212,0.12)',
    orbColor2: 'rgba(59,130,246,0.08)',
  }
  if (hour >= 17 && hour < 21) return {
    label: 'Good Evening',
    emoji: '🌆',
    colors: ['#8B5CF6', '#EC4899'],
    glow: 'rgba(139,92,246,0.4)',
    gradient: 'radial-gradient(ellipse at 50% 40%, rgba(139,92,246,0.12) 0%, transparent 70%)',
    orbColor1: 'rgba(236,72,153,0.12)',
    orbColor2: 'rgba(139,92,246,0.08)',
  }
  return {
    label: 'Good Night',
    emoji: '🌙',
    colors: ['#6366F1', '#312E81'],
    glow: 'rgba(99,102,241,0.4)',
    gradient: 'radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.12) 0%, transparent 70%)',
    orbColor1: 'rgba(99,102,241,0.15)',
    orbColor2: 'rgba(49,46,129,0.1)',
  }
}

// ── Animated Clock Component ──────────────────────────────
function LiveClock({ productiveMins, wasteMins, unloggedMins }) {
  const [now, setNow] = useState(new Date())
  const animRef = useRef(null)

  useEffect(() => {
    const tick = () => {
      setNow(new Date())
      animRef.current = requestAnimationFrame(() => {
        setTimeout(() => {
          animRef.current = requestAnimationFrame(tick)
        }, 1000)
      })
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const theme = getTimeTheme(hours)
  const secondsFraction = seconds / 60
  const displayHours = hours % 12 || 12
  const ampm = hours >= 12 ? 'PM' : 'AM'

  // SVG ring dimensions
  const ringSize = 140
  const ringStroke = 4
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCirc = 2 * Math.PI * ringRadius
  const secondsOffset = ringCirc - (secondsFraction * ringCirc)

  const colonStyle = {
    animation: 'colonPulse 1s ease-in-out infinite',
    display: 'inline-block',
  }

  return (
    <div style={{
      position: 'relative',
      borderRadius: '24px',
      padding: '32px 24px 24px',
      background: theme.gradient,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Floating orbs */}
      <div style={{
        position: 'absolute', width: '200px', height: '200px', borderRadius: '50%',
        background: theme.orbColor1, top: '-60px', right: '-40px',
        filter: 'blur(60px)', animation: 'floatOrb 8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: '160px', height: '160px', borderRadius: '50%',
        background: theme.orbColor2, bottom: '-30px', left: '-30px',
        filter: 'blur(50px)', animation: 'floatOrb 10s ease-in-out infinite reverse',
        pointerEvents: 'none',
      }} />

      {/* Greeting */}
      <div style={{
        textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)',
        marginBottom: '6px', fontWeight: '500',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}>
        <span>{theme.emoji}</span>
        <span>{theme.label}</span>
      </div>

      {/* Clock display with ring */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '16px', position: 'relative', zIndex: 1,
      }}>
        {/* Seconds ring */}
        <div style={{ position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 }}>
          <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth={ringStroke} />
            <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none"
              stroke={theme.colors[0]} strokeWidth={ringStroke}
              strokeDasharray={ringCirc} strokeDashoffset={secondsOffset}
              strokeLinecap="round"
              style={{
                transition: seconds === 0 ? 'none' : 'stroke-dashoffset 1s linear',
                filter: `drop-shadow(0 0 6px ${theme.glow})`,
              }}
            />
          </svg>
          {/* Time digits inside ring */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '36px', fontWeight: '800',
              color: 'var(--text-primary)',
              textShadow: `0 0 20px ${theme.glow}, 0 0 40px ${theme.glow}`,
              letterSpacing: '-1px',
              lineHeight: 1,
            }}>
              {String(displayHours).padStart(2, '0')}
              <span style={colonStyle}>:</span>
              {String(minutes).padStart(2, '0')}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px',
            }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '16px', fontWeight: '500',
                color: theme.colors[0], opacity: 0.9,
              }}>
                {String(seconds).padStart(2, '0')}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: '700',
                color: theme.colors[0], opacity: 0.7,
                letterSpacing: '0.05em',
              }}>
                {ampm}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's summary row */}
      <div style={{
        display: 'flex', gap: '6px', justifyContent: 'center',
        marginTop: '20px', position: 'relative', zIndex: 1,
      }}>
        {[
          { label: 'Productive', value: `${(productiveMins/60).toFixed(1)}h`, color: '#10B981' },
          { label: 'Waste', value: `${(wasteMins/60).toFixed(1)}h`, color: '#EF4444' },
          { label: 'Unlogged', value: `${(unloggedMins/60).toFixed(1)}h`, color: 'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            padding: '8px 14px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center', flex: 1, maxWidth: '120px',
          }}>
            <div style={{
              fontSize: '16px', fontWeight: '800',
              fontFamily: 'JetBrains Mono, monospace', color,
            }}>{value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div
      className="stat-card-premium metric-card-hover"
      style={{
        '--stat-accent': color,
        padding: '16px',
        borderRadius: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div className="metric-value" style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>
        {value}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────
export default function TimeFlow() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const location = useLocation()

  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)
  const categories = state.settings?.preferences?.timeCategories?.length
    ? state.settings.preferences.timeCategories
    : Object.keys(CATEGORY_COLORS)
  const defaultCategory = categories[0] || 'Study'

  const redirectDate = location.state?.selectedDate
  const [selectedDate, setSelectedDate] = useState(redirectDate || today)
  const [activeTab, setActiveTab] = useState('day')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [showAIModal, setShowAIModal] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [isSaved, setIsSaved] = useState(false)
  const [aiModalTab, setAiModalTab] = useState('auto')
  const [showQuickAI, setShowQuickAI] = useState(false)
  const [quickAIText, setQuickAIText] = useState('')
  const [quickAILoading, setQuickAILoading] = useState(false)
  const [quickAIParsed, setQuickAIParsed] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [quickAIChatHistory, setQuickAIChatHistory] = useState([])
  const [showOptimizerModal, setShowOptimizerModal] = useState(false)
  const [optimizerLoading, setOptimizerLoading] = useState(false)
  const [optimizerResult, setOptimizerResult] = useState(null)
  const [optimizerSaved, setOptimizerSaved] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [diaryImage, setDiaryImage] = useState(null)
  const [diaryImagePreview, setDiaryImagePreview] = useState(null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const recognitionRef = useRef(null)
  const diaryFileRef = useRef(null)
  const chatEndRef = useRef(null)
  const [form, setForm] = useState({
    name: '', category: defaultCategory, start: '09:00', end: '10:00',
    mood: 3, productivityScore: 3, isWaste: false, notes: '', tags: [],
  })

  const allEntries = state.timeflow?.entries || EMPTY_ARRAY

  const allTags = useMemo(() => [...new Set(allEntries.flatMap(e => e.tags || []))], [allEntries])
  const dayEntries = useMemo(
    () => allEntries
      .filter(e => e.date === selectedDate)
      .sort((a, b) => (a.start || '').localeCompare(b.start || '')),
    [allEntries, selectedDate]
  )

  // ── Calculations ──────────────────────────────────────────
  const { productiveMins, wasteMins, sleepMins, unloggedMins } = useMemo(() => {
    let productive = 0
    let waste = 0
    let sleep = 0
    let logged = 0

    dayEntries.forEach(entry => {
      const mins = Number(entry.durationMinutes) || 0
      logged += mins
      if (entry.category === 'Sleep') sleep += mins
      if (!entry.isWaste && entry.category !== 'Sleep' && entry.category !== 'Meals') productive += mins
      if (entry.isWaste || WASTE_CATEGORIES.includes(entry.category)) waste += mins
    })

    return {
      productiveMins: productive,
      wasteMins: waste,
      sleepMins: sleep,
      loggedMins: logged,
      unloggedMins: Math.max(0, 1440 - logged),
    }
  }, [dayEntries])

  // Donut data
  const donutData = useMemo(() => {
    const catTotals = {}
    dayEntries.forEach(e => {
      catTotals[e.category] = (catTotals[e.category] || 0) + (Number(e.durationMinutes) || 0)
    })
    return Object.entries(catTotals).map(([name, value]) => ({ name, value }))
  }, [dayEntries])

  // Weekly data (last 7 days)
  const weeklyData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = toDateKey(subDays(new Date(), 6 - i), timezone)
    const entries = allEntries.filter(e => e.date === d)
    const prod = entries.filter(e => !e.isWaste && e.category !== 'Sleep' && e.category !== 'Meals').reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)
    const waste = entries.filter(e => e.isWaste || WASTE_CATEGORIES.includes(e.category)).reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)
    return { day: formatDateKey(d, timezone, { weekday: 'short' }), productive: +(prod / 60).toFixed(1), waste: +(waste / 60).toFixed(1) }
  }), [allEntries, timezone])

  // ── Smart Time Auto-fill ────────────────────────────────
  function getSmartStartTime() {
    // Get the last entry's end time for the selected date
    if (dayEntries.length > 0) {
      const lastEntry = dayEntries[dayEntries.length - 1]
      return lastEntry.end || '09:00'
    }
    // If no entries, use current time rounded to nearest 15 min
    const now = new Date()
    const mins = Math.round(now.getMinutes() / 15) * 15
    const h = now.getHours()
    const m = mins >= 60 ? 0 : mins
    const adjustedH = mins >= 60 ? h + 1 : h
    return `${String(adjustedH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function getSmartEndTime(startTime) {
    // End time = start time + 1 hour
    const [h, m] = startTime.split(':').map(Number)
    const endH = Math.min(h + 1, 23)
    return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function resetForm() {
    const smartStart = getSmartStartTime()
    const smartEnd = getSmartEndTime(smartStart)
    setForm({
      name: '', category: defaultCategory, start: smartStart, end: smartEnd,
      mood: 3, productivityScore: 3, isWaste: false, notes: '', tags: [],
    })
  }

  function closeModal() {
    setShowAddModal(false)
    setEditingEntry(null)
    resetForm()
  }

  function startEdit(entry) {
    setEditingEntry(entry)
    setForm({
      name: entry.name || '',
      category: entry.category,
      start: entry.start,
      end: entry.end,
      mood: entry.mood ?? 3,
      productivityScore: entry.productivityScore ?? 3,
      isWaste: !!entry.isWaste,
      notes: entry.notes || '',
      tags: entry.tags || [],
    })
    setShowAddModal(true)
  }

  function saveEntry(entryData) {
    const [sh, sm] = entryData.start.split(':').map(Number)
    const [eh, em] = entryData.end.split(':').map(Number)
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm)
    if (durationMinutes <= 0) return alert('End time must be after start time')

    const payload = {
      date: selectedDate,
      start: entryData.start,
      end: entryData.end,
      durationMinutes,
      name: entryData.name || entryData.category,
      category: entryData.category,
      productivityScore: entryData.productivityScore,
      mood: entryData.mood,
      isWaste: entryData.isWaste || WASTE_CATEGORIES.includes(entryData.category),
      isBadHabit: entryData.isWaste,
      notes: entryData.notes || '',
      tags: entryData.tags || [],
      source: editingEntry?.source || 'manual',
      updatedAt: new Date().toISOString(),
      studySessionId: editingEntry?.studySessionId || null,
    }

    // Sync to Study module
    if (payload.category === 'Study') {
      const studySubjects = state.study?.subjects?.length 
        ? state.study.subjects 
        : ['Mathematics', 'Physics', 'CS Theory', 'Machine Learning', 'Deep Learning', 'DSA', 'Research Paper', 'Project Work', 'GATE Prep', 'Other']
      
      const cleanName = payload.name.replace(/^(?:study|studied|learning|learnt|read):\s*/i, '').trim()
      const matchedSubject = studySubjects.find(s => cleanName.toLowerCase().includes(s.toLowerCase()))
      
      const sessionSubject = matchedSubject || studySubjects[0] || 'Other'
      const sessionTopic = matchedSubject ? cleanName.replace(new RegExp(matchedSubject, 'i'), '').replace(/^[\s—\-•:]+/, '').trim() : cleanName

      const studySessions = state.study?.sessions || []
      
      if (editingEntry && editingEntry.studySessionId) {
        // Edit existing study session
        const updatedSessions = studySessions.map(s => 
          s.id === editingEntry.studySessionId 
            ? {
                ...s,
                date: payload.date,
                subject: sessionSubject,
                topic: sessionTopic || s.topic || 'Logged via TimeFlow',
                durationMinutes: payload.durationMinutes,
                rating: payload.productivityScore,
                notes: payload.notes || s.notes,
                updatedAt: new Date().toISOString(),
              }
            : s
        )
        setModule('study', { ...state.study, sessions: updatedSessions })
      } else {
        // Create new linked study session
        const studySessionId = uuid()
        const newSession = {
          id: studySessionId,
          date: payload.date,
          subject: sessionSubject,
          topic: sessionTopic || 'Logged via TimeFlow',
          focusType: 'Deep Focus',
          durationMinutes: payload.durationMinutes,
          notes: payload.notes || '',
          rating: payload.productivityScore,
          source: 'timeflow-sync',
          createdAt: new Date().toISOString(),
        }
        payload.studySessionId = studySessionId
        setModule('study', { ...state.study, sessions: [newSession, ...studySessions] })
      }
    } else if (editingEntry && editingEntry.category === 'Study' && editingEntry.studySessionId) {
      // If it was study but category changed, delete study session
      const studySessions = state.study?.sessions || []
      setModule('study', { ...state.study, sessions: studySessions.filter(s => s.id !== editingEntry.studySessionId) })
      payload.studySessionId = null
    }

    if (editingEntry) {
      const updated = allEntries.map(e =>
        e.id === editingEntry.id ? { ...e, ...payload } : e
      )
      setModule('timeflow', { ...state.timeflow, entries: updated })
      showToast('Entry updated ✓', 'success')
    } else {
      const newEntry = { id: uuid(), ...payload, createdAt: new Date().toISOString() }
      setModule('timeflow', { ...state.timeflow, entries: [...allEntries, newEntry] })
      showToast('Entry saved ✓', 'success')
    }

    closeModal()
  }

  function deleteEntry(id) {
    const removed = allEntries.find(e => e.id === id)
    if (!removed) return
    const prev = allEntries
    const prevStudy = state.study?.sessions || []

    setModule('timeflow', { ...state.timeflow, entries: allEntries.filter(e => e.id !== id) })
    
    if (removed.category === 'Study' && removed.studySessionId) {
      setModule('study', { ...state.study, sessions: prevStudy.filter(s => s.id !== removed.studySessionId) })
    }

    showToast('Entry deleted', 'warning', {
      undo: () => {
        setModule('timeflow', { ...state.timeflow, entries: prev })
        if (removed.category === 'Study' && removed.studySessionId) {
          setModule('study', { ...state.study, sessions: prevStudy })
        }
      },
    })
  }

  function saveAnalysisToJournal(analysis, date) {
    if (!analysis) return

    // Format content nicely
    let content = `## ⚡ Quick Summary\n${analysis.shortSummary || 'No summary generated.'}\n\n`
    content += `## 🎯 Kal Se Ye Karo (Tomorrow's Action Plan)\n`
    if (analysis.tomorrowActions && analysis.tomorrowActions.length > 0) {
      content += analysis.tomorrowActions.map((a, i) => `${i + 1}. ${a}`).join('\n') + '\n\n'
    } else {
      content += `No action items generated.\n\n`
    }
    
    if (analysis.detailedAnalysis) {
      content += `## 📊 Detailed Analysis\n${analysis.detailedAnalysis}\n\n`
    }

    content += `## 💡 Insights\n`
    if (analysis.insights && analysis.insights.length > 0) {
      content += analysis.insights.map(i => `• ${i}`).join('\n') + '\n\n'
    } else {
      content += `No insights.\n\n`
    }

    content += `## ✨ Good Habits\n`
    if (analysis.goodHabits && analysis.goodHabits.length > 0) {
      content += analysis.goodHabits.map(h => `• ${h}`).join('\n') + '\n\n'
    } else {
      content += `No good habits identified.\n\n`
    }

    content += `## ⚠️ Bad Habits / Time Wasters\n`
    if (analysis.badHabits && analysis.badHabits.length > 0) {
      content += analysis.badHabits.map(h => `• ${h}`).join('\n') + '\n\n'
    } else {
      content += `No bad habits identified.\n\n`
    }

    content += `## 🚀 Suggestions\n`
    if (analysis.suggestions && analysis.suggestions.length > 0) {
      content += analysis.suggestions.map(s => `• ${s}`).join('\n') + '\n\n'
    } else {
      content += `No suggestions.\n\n`
    }

    // Determine mood rating (1-5) based on dayScore (1-10)
    const score = Number(analysis.dayScore) || 7
    const moodValue = Math.min(5, Math.max(1, Math.ceil(score / 2)))

    // Save to journal state
    const journalEntries = state.journal?.entries || []
    
    // Check if there is an existing entry for this day with the same source
    const existingIndex = journalEntries.findIndex(
      e => e.date === date && e.source === 'timeflow-ai-analysis'
    )

    const payload = {
      date,
      title: `🤖 AI TimeFlow Analysis — ${date}`,
      content: content.trim(),
      mood: moodValue,
      energy: 3,
      gratitude: '',
      tags: ['ai-timeflow-analysis', 'auto-generated'],
      source: 'timeflow-ai-analysis',
      aiSentiment: score >= 8 ? 'Very Positive' : score >= 5 ? 'Neutral' : 'Needs Improvement',
      aiRecommendation: analysis.tomorrowActions ? analysis.tomorrowActions.join('; ') : '',
      updatedAt: new Date().toISOString(),
    }

    let updatedEntries
    if (existingIndex > -1) {
      // Update existing
      updatedEntries = journalEntries.map((e, idx) => 
        idx === existingIndex ? { ...e, ...payload } : e
      )
    } else {
      // Add new
      const newEntry = {
        id: uuid(),
        ...payload,
        createdAt: new Date().toISOString(),
      }
      updatedEntries = [newEntry, ...journalEntries]
    }

    setModule('journal', {
      ...state.journal,
      entries: updatedEntries,
    })
    setIsSaved(true)
    showToast('Analysis saved to Journal ✓', 'success')
  }

  async function analyseWithAI() {
    if (!freeText.trim()) return
    setAiLoading(true)
    setAiResult(null)
    setIsSaved(false)
    const apiKey = getGeminiApiKey()

    if (!apiKey) {
      setAiLoading(false)
      setAiResult({
        error: true,
        message: 'No Gemini API key found. Go to Settings → API Keys to add your key.',
      })
      return
    }

    try {
      const categoryList = categories.join('|')
      const prompt = `You are a personal life analyst. Extract structured time entries from the user's daily log text. Provide a short summary, a detailed analysis paragraph, a day score out of 10, and a list of tomorrow action items ("kal se ye karo"). Return ONLY valid JSON, no markdown, no explanation.

Return format:
{
  "activities": [
    {
      "start": "HH:MM",
      "end": "HH:MM",
      "name": "activity name",
      "category": "one of: ${categoryList}",
      "productivityScore": 1-5,
      "isWaste": boolean,
      "notes": ""
    }
  ],
  "insights": ["insight 1", "insight 2"],
  "badHabits": ["bad habit if any"],
  "goodHabits": ["good habit if any"],
  "totalWasteMinutes": number,
  "totalProductiveMinutes": number,
  "suggestions": ["suggestion 1", "suggestion 2"],
  "tomorrowActions": ["what user should do starting tomorrow to improve, written in Hindi/English mix like 'kal se ye karo to improve...'"],
  "shortSummary": "quick 3-4 line TL;DR summary of the day",
  "detailedAnalysis": "detailed analysis paragraph of how the day went",
  "dayScore": 1-10
}

User's day: ${freeText}`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      )
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setAiResult(parsed)
        saveAnalysisToJournal(parsed, selectedDate)
      } else {
        setAiResult({ error: true, message: 'Could not parse AI response. Try again.' })
      }
    } catch {
      setAiResult({ error: true, message: 'AI request failed. Check your API key.' })
    }
    setAiLoading(false)
  }

  async function runAutoTimelineAnalysis() {
    if (dayEntries.length === 0) return
    setAiLoading(true)
    setAiResult(null)
    setIsSaved(false)
    const apiKey = getGeminiApiKey()

    if (!apiKey) {
      setAiLoading(false)
      setAiResult({
        error: true,
        message: 'No Gemini API key found. Go to Settings → API Keys to add your key.',
      })
      return
    }

    try {
      const formattedTimeline = dayEntries.map(e => `- ${e.start} to ${e.end} (${e.durationMinutes} mins): ${e.name} [Category: ${e.category}, Productivity Score: ${e.productivityScore}/5, Waste: ${e.isWaste ? 'Yes' : 'No'}]`).join('\n')
      
      const prompt = `You are a world-class productivity coach and life analyst. Analyze the user's logged daily timeline and provide high-value, actionable suggestions, insights, habits, a short summary, a detailed analysis paragraph, a day score out of 10, and tomorrow's action items ("kal se ye karo"). Keep feedback helpful and direct.

Here is their timeline for the day (${selectedDate}):
${formattedTimeline}

Return ONLY valid JSON in this format, no markdown, no explanation:
{
  "insights": ["specific insight 1", "specific insight 2"],
  "badHabits": ["time waster or poor habit identified if any"],
  "goodHabits": ["positive behavior or habit identified if any"],
  "suggestions": ["actionable improvement suggestion 1", "actionable improvement suggestion 2"],
  "tomorrowActions": ["what user should do starting tomorrow to improve, written in Hindi/English mix like 'kal se ye karo to improve...'"],
  "shortSummary": "quick 3-4 line TL;DR summary of the day",
  "detailedAnalysis": "detailed analysis paragraph of how the day went",
  "dayScore": 1-10
}`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 },
          }),
        }
      )
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setAiResult(parsed)
        saveAnalysisToJournal(parsed, selectedDate)
      } else {
        setAiResult({ error: true, message: 'Could not parse AI performance report. Please try again.' })
      }
    } catch (err) {
      console.error(err)
      setAiResult({ error: true, message: 'AI request failed. Check connection or Gemini key.' })
    }
    setAiLoading(false)
  }

  function importAIEntries() {
    if (!aiResult?.activities) return
    const newEntries = aiResult.activities
      .filter(a => a.start && a.end)
      .map(a => {
        const [sh, sm] = a.start.split(':').map(Number)
        const [eh, em] = a.end.split(':').map(Number)
        return {
          id: uuid(), date: selectedDate,
          start: a.start, end: a.end,
          durationMinutes: (eh * 60 + em) - (sh * 60 + sm),
          name: a.name, category: a.category,
          productivityScore: a.productivityScore || 3,
          mood: 3, isWaste: a.isWaste || WASTE_CATEGORIES.includes(a.category),
          isBadHabit: a.isWaste, notes: a.notes || '',
          source: 'ai-parsed', createdAt: new Date().toISOString(),
        }
      })
      .filter(e => e.durationMinutes > 0)

    // ── MERGE: Keep existing entries, only add non-overlapping new ones ──
    const existingToday = allEntries.filter(e => e.date === selectedDate)
    const entriesOtherDays = allEntries.filter(e => e.date !== selectedDate)

    // Helper: convert "HH:MM" to minutes since midnight
    const toMins = (t) => {
      if (!t) return 0
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }

    // Check if two time ranges overlap (more than 10 min overlap = duplicate)
    const isOverlapping = (a, b) => {
      const aStart = toMins(a.start), aEnd = toMins(a.end)
      const bStart = toMins(b.start), bEnd = toMins(b.end)
      const overlapStart = Math.max(aStart, bStart)
      const overlapEnd = Math.min(aEnd, bEnd)
      return (overlapEnd - overlapStart) > 10 // >10 min overlap = same entry
    }

    // Filter out new entries that overlap with existing entries
    const genuinelyNew = newEntries.filter(newEntry =>
      !existingToday.some(existing => isOverlapping(existing, newEntry))
    )

    if (genuinelyNew.length === 0 && newEntries.length > 0) {
      showToast('All entries already exist in your timeline!', 'info')
    } else if (genuinelyNew.length < newEntries.length) {
      showToast(`✅ Added ${genuinelyNew.length} new entries (${newEntries.length - genuinelyNew.length} duplicates skipped)`, 'success')
    } else {
      showToast(`✅ Imported ${genuinelyNew.length} entries to timeline!`, 'success')
    }

    // Save diary analysis metadata for the date
    if (aiResult.dailySummary || aiResult.wasteBreakdown || aiResult.studyBreakdown) {
      const currentTimeflow = state.timeflow || {}
      const diaryAnalysis = currentTimeflow.diaryAnalysis || {}
      diaryAnalysis[selectedDate] = {
        dailySummary: aiResult.dailySummary,
        wasteBreakdown: aiResult.wasteBreakdown,
        studyBreakdown: aiResult.studyBreakdown,
        optimizationTips: aiResult.optimizationTips,
        dayScore: aiResult.dayScore,
        shortSummary: aiResult.shortSummary,
        analyzedAt: new Date().toISOString(),
      }
      setModule('timeflow', { ...state.timeflow, entries: [...entriesOtherDays, ...existingToday, ...genuinelyNew], diaryAnalysis })
    } else {
      setModule('timeflow', { ...state.timeflow, entries: [...entriesOtherDays, ...existingToday, ...genuinelyNew] })
    }

    setShowAIModal(false)
    setFreeText('')
    setAiResult(null)
  }

  // ── Diary Photo Scanner (Handwriting → Time Entries) ────
  const handleDiaryFile = useCallback((file) => {
    if (!file) return
    if (!file.type || !file.type.startsWith('image/')) {
      showToast('Please select or paste a valid image file', 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image too large (max 10MB)', 'error')
      return
    }
    setDiaryImage(file)
    setDiaryImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setAiResult(null)
    setIsSaved(false)
  }, [showToast])

  function handleDiaryImageSelect(e) {
    const file = e.target.files?.[0]
    if (file) handleDiaryFile(file)
    e.target.value = ''
  }

  // Handle clipboard paste (Ctrl+V) when modal is open and on photo tab
  useEffect(() => {
    if (!showAIModal || aiModalTab !== 'photo') return

    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleDiaryFile(file)
            showToast('Photo pasted from clipboard! 📋', 'success')
            break
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [showAIModal, aiModalTab, handleDiaryFile, showToast])

  async function processDiaryPhoto() {
    if (!diaryImage) return
    setDiaryLoading(true)
    setAiResult(null)
    setIsSaved(false)

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setDiaryLoading(false)
      setAiResult({ error: true, message: 'No Gemini API key found. Go to Settings → API Keys.' })
      return
    }

    try {
      // Convert image to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(diaryImage)
      })

      const categoryList = categories.join('|')
      const prompt = `You are an expert at reading handwritten Hindi/English diary entries. The user photographs their daily time-log diary page.

DIARY FORMAT RULES:
- Each entry follows: "→ START_TIME to END_TIME — ACTIVITY (optional flags)"
- Times may be in 12h or 24h format. Convert ALL to 24-hour HH:MM.
- "Padhai" = Study. Extract subject if mentioned (e.g., "ML padha" → Study: ML)
- "Exam" / "exam dene gaya" = Study (exam). Mark as category: "Study", include "exam" in name.
- "Soya" / "Sleep" = Sleep category
- "Waste Soya" = Sleep BUT isWaste: true (unproductive oversleeping)
- "(Waste)" or "[Waste]" flag next to activity → isWaste: true
- "Wait in lab" = Other category, isWaste: false (unavoidable)
- "Lunch" / "Khana" = Meals category
- "Rishi ki Baat" / any socializing with "(Waste)" → Waste Time category, isWaste: true
- "fever" / "beemar" / illness → Other category, isWaste: false, notes: medical reason
- If "Waste due to" appears → isWaste: true, preserve the reason in notes
- Combined entries like "Lunch + Rishi ki Baat (Waste)" → Split into 2 if possible, or mark the combined entry as waste if (Waste) flag is present

SUMMARY SECTION:
- The diary may have a summary at the bottom with calculations like "5+1+2+3 = 11 hour Padhai"
- Extract this into dailySummary
- User may write goals like "Try to stretch to 14 hours" → extract into userGoalNotes

CATEGORY MAPPING:
- Padhai/Study/पढ़ाई → "Study"
- Exam/परीक्षा → "Study" (mark name as "Exam - [subject]")
- Soya/Sleep/सोया → "Sleep"
- Exercise/Gym/व्यायाम → "Exercise"
- Lunch/Dinner/Breakfast/Khana → "Meals"
- Social Media/Reels/YouTube → "Social Media" (isWaste: true)
- Entertainment/Netflix/Games → "Entertainment" (isWaste: true)
- Wait/Idle/Free → "Other"
- Travel/Commute → "Travel"
- Morning Routine → "Morning Routine"
- Anything with (Waste) flag → respective category BUT isWaste: true
- General waste/time pass → "Waste Time" (isWaste: true)

Available categories: ${categoryList}

Return ONLY valid JSON:
{
  "activities": [
    {
      "start": "HH:MM",
      "end": "HH:MM",
      "name": "activity name (preserve user's original language + add English)",
      "category": "one of the available categories",
      "productivityScore": 1-5,
      "isWaste": boolean,
      "notes": "preserve any notes, reasons, waste explanations from diary"
    }
  ],
  "rawText": "Full transcribed text from handwriting",
  "dailySummary": {
    "totalStudyHours": number,
    "totalSleepHours": number,
    "totalWasteHours": number,
    "totalWaitHours": number,
    "totalMealsHours": number,
    "userGoalNotes": "extracted goal/improvement notes from diary"
  },
  "wasteBreakdown": [
    {
      "activity": "name",
      "hours": number,
      "reason": "why it was waste",
      "suggestion": "how to reduce this waste"
    }
  ],
  "studyBreakdown": [
    {
      "subject": "subject or General Study",
      "hours": number,
      "type": "study" or "exam"
    }
  ],
  "optimizationTips": ["specific tip based on this day's data"],
  "insights": ["insight about the day"],
  "shortSummary": "3-4 line summary of the day",
  "dayScore": 1-10,
  "confidence": "high" or "medium" or "low"
}`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: diaryImage.type,
                    data: base64,
                  }
                }
              ]
            }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      )

      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setAiResult(parsed)
        if (parsed.activities?.length > 0) {
          showToast(`📷 Found ${parsed.activities.length} entries from your diary!`, 'success')
        }
      } else {
        setAiResult({ error: true, message: 'Could not read the handwriting. Try a clearer photo.' })
      }
    } catch (err) {
      console.error(err)
      setAiResult({ error: true, message: 'Failed to process image. Check your API key and connection.' })
    }
    setDiaryLoading(false)
  }

  function clearDiaryImage() {
    setDiaryImage(null)
    if (diaryImagePreview) URL.revokeObjectURL(diaryImagePreview)
    setDiaryImagePreview(null)
    if (diaryFileRef.current) diaryFileRef.current.value = ''
  }

  // ── AI Quick Add (Chat/Voice) ───────────────────────────
  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast('Voice input not supported in this browser', 'error')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'hi-IN' // Hindi+English mix
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setQuickAIText(prev => prev ? prev + ' ' + transcript : transcript)
      setIsListening(false)
    }
    recognition.onerror = () => {
      setIsListening(false)
      showToast('Voice input failed, try again', 'error')
    }
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  function stopVoiceInput() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  async function handleQuickAISend() {
    if (!quickAIText.trim()) return
    const userMsg = quickAIText.trim()
    setQuickAIChatHistory(prev => [...prev, { role: 'user', text: userMsg }])
    setQuickAIText('')
    setQuickAILoading(true)
    setQuickAIParsed(null)

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setQuickAIChatHistory(prev => [...prev, { role: 'ai', text: '❌ No Gemini API key found. Go to Settings → API Keys to add your key.' }])
      setQuickAILoading(false)
      return
    }

    try {
      const categoryList = categories.join('|')
      const prompt = `You are a smart time-tracking assistant. The user will tell you what activities they did and when, in casual Hindi/English mix. Extract structured time entries from their message.

IMPORTANT: The user might say things like:
- "mene 2 bje se 4 bje tk ML padha" → Study from 14:00 to 16:00
- "subah 6 se 7 exercise ki" → Exercise from 06:00 to 07:00  
- "raat 10 bje se 12 bje tk reels dekhi" → Social Media from 22:00 to 00:00
- "lunch 1 se 2" → Meals from 13:00 to 14:00
- "3 se 5 coding kiya, phir 5 se 6 gym gaya" → two entries

Parse ALL activities mentioned. Convert Hindi time references to 24-hour format.
Available categories: ${categoryList}

Return ONLY valid JSON, no markdown:
{
  "entries": [
    {
      "start": "HH:MM",
      "end": "HH:MM",
      "name": "activity name in user's language",
      "category": "one of: ${categoryList}",
      "productivityScore": 1-5,
      "isWaste": boolean
    }
  ],
  "reply": "A friendly confirmation message in Hinglish like 'Done bhai! 2 entries add kar di 🔥' — keep it short and casual"
}

User says: ${userMsg}`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      )
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setQuickAIParsed(parsed)
        setQuickAIChatHistory(prev => [...prev, {
          role: 'ai',
          text: parsed.reply || 'Entries parsed! Review below and click Save.',
          entries: parsed.entries || [],
        }])
      } else {
        setQuickAIChatHistory(prev => [...prev, { role: 'ai', text: '😅 Samajh nahi aaya bhai, thoda aur clearly batao — like "2 se 4 bje ML padha"' }])
      }
    } catch {
      setQuickAIChatHistory(prev => [...prev, { role: 'ai', text: '❌ AI request fail ho gaya. Connection ya API key check karo.' }])
    }
    setQuickAILoading(false)
  }

  function saveQuickAIEntries(entries) {
    if (!entries?.length) return
    const newEntries = entries
      .filter(a => a.start && a.end)
      .map(a => {
        const [sh, sm] = a.start.split(':').map(Number)
        const [eh, em] = a.end.split(':').map(Number)
        let dur = (eh * 60 + em) - (sh * 60 + sm)
        if (dur < 0) dur += 1440 // overnight
        return {
          id: uuid(), date: selectedDate,
          start: a.start, end: a.end,
          durationMinutes: dur,
          name: a.name, category: a.category || 'Other',
          productivityScore: a.productivityScore || 3,
          mood: 3, isWaste: a.isWaste || WASTE_CATEGORIES.includes(a.category),
          isBadHabit: a.isWaste, notes: '',
          tags: [], source: 'ai-quick-add', createdAt: new Date().toISOString(),
        }
      })
      .filter(e => e.durationMinutes > 0)

    if (newEntries.length === 0) {
      showToast('No valid entries to save', 'error')
      return
    }

    // Save each entry through the saveEntry flow for Study sync
    newEntries.forEach(entry => {
      const payload = { ...entry }
      // Sync study entries
      if (payload.category === 'Study') {
        const studySubjects = state.study?.subjects?.length
          ? state.study.subjects
          : ['Mathematics', 'Physics', 'CS Theory', 'Machine Learning', 'Deep Learning', 'DSA', 'Research Paper', 'Project Work', 'GATE Prep', 'Other']
        const cleanName = payload.name.replace(/^(?:study|studied|learning|learnt|read):\s*/i, '').trim()
        const matchedSubject = studySubjects.find(s => cleanName.toLowerCase().includes(s.toLowerCase()))
        const sessionSubject = matchedSubject || studySubjects[0] || 'Other'
        const sessionTopic = matchedSubject ? cleanName.replace(new RegExp(matchedSubject, 'i'), '').replace(/^[\s—\-•:]+/, '').trim() : cleanName
        const studySessionId = uuid()
        const newSession = {
          id: studySessionId, date: payload.date, subject: sessionSubject,
          topic: sessionTopic || 'Logged via AI Quick Add', focusType: 'Deep Focus',
          durationMinutes: payload.durationMinutes, notes: '', rating: payload.productivityScore,
          source: 'timeflow-ai-quick', createdAt: new Date().toISOString(),
        }
        payload.studySessionId = studySessionId
        const studySessions = state.study?.sessions || []
        setModule('study', { ...state.study, sessions: [newSession, ...studySessions] })
      }
    })

    setModule('timeflow', { ...state.timeflow, entries: [...allEntries, ...newEntries] })
    showToast(`${newEntries.length} entries added ✓`, 'success')
    setQuickAIParsed(null)
  }

  // ── AI Time Optimizer ─────────────────────────────────────
  async function runTimeOptimizer() {
    if (dayEntries.length === 0) return
    setOptimizerLoading(true)
    setOptimizerResult(null)
    setOptimizerSaved(false)
    const apiKey = getGeminiApiKey()

    if (!apiKey) {
      setOptimizerLoading(false)
      setOptimizerResult({ error: true, message: 'No Gemini API key found. Go to Settings → API Keys to add your key.' })
      return
    }

    try {
      const formattedTimeline = dayEntries.map(e => `- ${e.start} to ${e.end} (${e.durationMinutes} mins): ${e.name} [Category: ${e.category}, Waste: ${e.isWaste ? 'Yes' : 'No'}]`).join('\n')

      const prompt = `You are a ruthless time-optimization coach. The user's PRIMARY GOAL is to MAXIMIZE STUDY TIME. Analyze their daily timeline and find every single minute that can be saved from non-study activities.

For EACH non-study, non-sleep activity, suggest a realistic but aggressive time reduction. Be specific — give exact target minutes for tomorrow. Flag activities with:
- 🔴 for major time wasters (>30 min saving possible)
- 🟡 for moderate optimization (10-30 min saving)
- 🟢 for already efficient (< 10 min saving)

Here is their timeline for ${selectedDate}:
${formattedTimeline}

Return ONLY valid JSON, no markdown, no explanation:
{
  "currentStudyMins": number,
  "potentialStudyMins": number,
  "timeGainMins": number,
  "flaggedActivities": [
    {
      "name": "activity name",
      "category": "category",
      "currentMins": number,
      "suggestedMins": number,
      "savingMins": number,
      "flag": "🔴 or 🟡 or 🟢",
      "tip": "specific actionable tip in Hinglish mix"
    }
  ],
  "tomorrowScheduleTips": ["specific tip 1 in Hinglish", "specific tip 2"],
  "quickWins": ["easiest changes that save the most time"],
  "motivationalNote": "short motivational message in Hinglish",
  "optimizedDayPlan": "brief description of how an optimized version of this day would look"
}`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 },
          }),
        }
      )
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setOptimizerResult(parsed)
        saveOptimizerToJournal(parsed, selectedDate)
      } else {
        setOptimizerResult({ error: true, message: 'Could not parse AI response. Try again.' })
      }
    } catch (err) {
      console.error(err)
      setOptimizerResult({ error: true, message: 'AI request failed. Check connection or Gemini key.' })
    }
    setOptimizerLoading(false)
  }

  function saveOptimizerToJournal(result, date) {
    if (!result || result.error) return

    let content = `## 📈 Time Optimization Report\n\n`
    content += `**Current Study Time:** ${(result.currentStudyMins / 60).toFixed(1)}h → **Potential:** ${(result.potentialStudyMins / 60).toFixed(1)}h (+${(result.timeGainMins / 60).toFixed(1)}h gain)\n\n`

    content += `## 🚩 Flagged Activities\n`
    if (result.flaggedActivities?.length > 0) {
      result.flaggedActivities.forEach((a, i) => {
        content += `${i + 1}. ${a.flag || '🚩'} **${a.name}** (${a.category}): ${a.currentMins}min → ${a.suggestedMins}min (save ${a.savingMins}min)\n`
        content += `   💡 ${a.tip}\n`
      })
      content += '\n'
    }

    content += `## ⏰ Tomorrow's Schedule Tips\n`
    if (result.tomorrowScheduleTips?.length > 0) {
      content += result.tomorrowScheduleTips.map((t, i) => `${i + 1}. ${t}`).join('\n') + '\n\n'
    }

    if (result.quickWins?.length > 0) {
      content += `## ⚡ Quick Wins\n`
      content += result.quickWins.map(w => `• ${w}`).join('\n') + '\n\n'
    }

    if (result.optimizedDayPlan) {
      content += `## 🗓️ Optimized Day Plan\n${result.optimizedDayPlan}\n\n`
    }

    if (result.motivationalNote) {
      content += `## 💪 Motivation\n${result.motivationalNote}\n`
    }

    const journalEntries = state.journal?.entries || []
    const existingIndex = journalEntries.findIndex(
      e => e.date === date && e.source === 'timeflow-ai-optimizer'
    )

    const payload = {
      date,
      title: `📈 How to Improve Next Day — ${date}`,
      content: content.trim(),
      mood: 3,
      energy: 3,
      gratitude: '',
      tags: ['ai-optimizer', 'auto-generated', 'improvement-plan'],
      source: 'timeflow-ai-optimizer',
      aiSentiment: 'Action Plan',
      aiRecommendation: result.tomorrowScheduleTips ? result.tomorrowScheduleTips.join('; ') : '',
      updatedAt: new Date().toISOString(),
    }

    let updatedEntries
    if (existingIndex > -1) {
      updatedEntries = journalEntries.map((e, idx) =>
        idx === existingIndex ? { ...e, ...payload } : e
      )
    } else {
      updatedEntries = [{ id: uuid(), ...payload, createdAt: new Date().toISOString() }, ...journalEntries]
    }

    setModule('journal', { ...state.journal, entries: updatedEntries })
    setOptimizerSaved(true)
    showToast('Improvement plan saved to Journal ✓', 'success')
  }

  async function generateDetailNotes() {
    if (!form.name && !form.category) return
    setDetailLoading(true)
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      showToast('No Gemini API key. Go to Settings → API Keys.', 'error')
      setDetailLoading(false)
      return
    }

    try {
      const isWaste = form.isWaste || WASTE_CATEGORIES.includes(form.category)
      const prompt = `You are a personal life-logging assistant. The user logged this activity in their daily timeline:

Activity: "${form.name || form.category}"
Category: ${form.category}
Time: ${form.start} to ${form.end}
Is Time Waste: ${isWaste ? 'Yes' : 'No'}

Write a detailed 2-4 sentence note describing what likely happened during this time. Be specific and realistic. If it was a waste activity, mention what could have been done instead. Write in a casual Hinglish style (Hindi-English mix). Don't add any greeting or heading — just the note text directly.`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5 },
          }),
        }
      )
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) {
        setForm(f => ({ ...f, notes: text.trim() }))
        showToast('AI notes generated ✓', 'success')
      }
    } catch {
      showToast('AI detail generation failed', 'error')
    }
    setDetailLoading(false)
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [quickAIChatHistory])

  // ── Styles ────────────────────────────────────────────────
  const tabStyle = (active) => ({
    padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--accent-amber)' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid var(--accent-amber)' : '2px solid transparent',
  })
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }
  const labelStyle = {
    fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700',
    marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>⏱️ Time Flow</h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => {
            setQuickAIChatHistory([])
            setQuickAIText('')
            setQuickAIParsed(null)
            setShowQuickAI(true)
          }} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Zap size={14} /> AI Quick Add
          </Button>
          <Button variant="secondary" onClick={() => {
            setAiResult(null)
            setIsSaved(false)
            setDiaryImage(null)
            setDiaryImagePreview(null)
            setAiModalTab('photo')
            setShowAIModal(true)
          }} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#10B981', fontWeight: '700'
          }}>
            <Camera size={14} /> 📷 Diary Photo
          </Button>
          <Button variant="secondary" onClick={() => {
            setAiResult(null);
            setIsSaved(false);
            setAiModalTab(dayEntries.length > 0 ? 'auto' : 'text');
            setShowAIModal(true);
          }}>
            ✨ Analyse
          </Button>
          <Button variant="secondary" onClick={() => {
            setOptimizerResult(null);
            setOptimizerSaved(false);
            setShowOptimizerModal(true);
          }} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA' }}>
            <Target size={14} /> Optimize
          </Button>
          <Button onClick={() => { resetForm(); setShowAddModal(true) }}>
            <Plus size={16} /> Add Entry
          </Button>
        </div>
      </div>

      {/* ═══ Glassmorphic Live Clock ═══════════════════════════ */}
      <div style={{ padding: '16px 24px 0' }}>
        <LiveClock
          productiveMins={selectedDate === today ? productiveMins : 0}
          wasteMins={selectedDate === today ? wasteMins : 0}
          unloggedMins={selectedDate === today ? unloggedMins : 0}
        />
      </div>

      {/* Date Picker */}
      <div style={{ padding: '12px 24px 0' }}>
        <input
          type="date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ ...inputStyle, width: 'auto', fontSize: '13px', padding: '8px 12px' }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '12px 24px 0', borderBottom: '1px solid var(--border)' }}>
        {['day', 'week'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab === 'day' ? 'Day View' : 'Week View'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ══ DAY VIEW ═══════════════════════════════════════ */}
        {activeTab === 'day' && <>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <StatCard label="Productive" value={`${(productiveMins/60).toFixed(1)}h`} color="#10B981" />
            <StatCard label="Waste Time" value={`${(wasteMins/60).toFixed(1)}h`} color="#EF4444" />
            <StatCard label="Sleep" value={`${(sleepMins/60).toFixed(1)}h`} color="#8B5CF6" />
            <StatCard label="Logged" value={`${dayEntries.length} entries`} color="#3B82F6" />
          </div>

          {/* Timeline */}
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>
              Timeline — {selectedDate === today ? 'Today' : selectedDate}
            </h3>
            {dayEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '15px' }}>No entries for this day</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Upload your diary photo, write in plain text, or add entries manually</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                  <Button variant="secondary" onClick={() => {
                    setAiResult(null)
                    setIsSaved(false)
                    setDiaryImage(null)
                    setDiaryImagePreview(null)
                    setAiModalTab('photo')
                    setShowAIModal(true)
                  }} style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '5px', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)' }}>
                    <Camera size={13} /> 📷 Upload Diary Photo
                  </Button>
                  <Button variant="secondary" onClick={() => {
                    setAiResult(null)
                    setIsSaved(false)
                    setAiModalTab('text')
                    setShowAIModal(true)
                  }} style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    ✍️ Text Log
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {dayEntries.map((entry, idx) => (
                  <TimelineEntry key={entry.id} entry={entry} onDelete={deleteEntry} onEdit={startEdit} isLast={idx === dayEntries.length - 1} index={idx} />
                ))}
              </div>
            )}
          </Card>

          {/* Donut chart */}
          {donutData.length > 0 && (
            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Today's Time Distribution</h3>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#6B7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${(v/60).toFixed(1)}h`} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '140px' }}>
                  {donutData.map(({ name, value }) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: CATEGORY_COLORS[name] || '#6B7280', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', flex: 1, color: 'var(--text-secondary)' }}>{name}</span>
                      <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{(value/60).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>}

        {/* ══ WEEK VIEW ══════════════════════════════════════ */}
        {activeTab === 'week' && <>
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>Productive vs Waste Time (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, name) => [`${v}h`, name === 'productive' ? 'Productive' : 'Waste']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="productive" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: '#3B82F6', r: 4 }} />
                <Line type="monotone" dataKey="waste" stroke="#EF4444" strokeWidth={2.5} dot={{ fill: '#EF4444', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ width: '12px', height: '3px', background: '#3B82F6', borderRadius: '2px' }} /> Productive
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ width: '12px', height: '3px', background: '#EF4444', borderRadius: '2px' }} /> Waste
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[
              { label: 'Avg Productive/day', value: `${(weeklyData.reduce((a, d) => a + d.productive, 0) / 7).toFixed(1)}h`, color: '#3B82F6' },
              { label: 'Avg Waste/day', value: `${(weeklyData.reduce((a, d) => a + d.waste, 0) / 7).toFixed(1)}h`, color: '#EF4444' },
              { label: 'Best Day', value: weeklyData.reduce((a, d) => d.productive > a.productive ? d : a, weeklyData[0])?.day || '-', color: '#10B981' },
              { label: 'Worst Day', value: weeklyData.reduce((a, d) => d.waste > a.waste ? d : a, weeklyData[0])?.day || '-', color: '#F43F5E' },
            ].map(({ label, value, color }) => (
              <Card key={label} style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
              </Card>
            ))}
          </div>
        </>}

      </div>

      {/* ══ ADD ENTRY MODAL ════════════════════════════════════ */}
      <Modal isOpen={showAddModal} onClose={closeModal} title={editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Activity Name</label>
            <input style={inputStyle} placeholder="e.g. Deep Work on ML project" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, isWaste: WASTE_CATEGORIES.includes(e.target.value) }))}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Start Time</label>
              <input style={inputStyle} type="time" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>End Time</label>
              <input style={inputStyle} type="time" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Productivity Score</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, productivityScore: n }))} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                  borderColor: form.productivityScore >= n ? '#3B82F6' : 'var(--border)',
                  background: form.productivityScore >= n ? 'rgba(59,130,246,0.15)' : 'transparent',
                  cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                  color: form.productivityScore >= n ? '#3B82F6' : 'var(--text-muted)',
                }}>
                  {['😫','😕','😐','🙂','😄'][n-1]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px', lineHeight: '1.5' }} placeholder="Any notes about this activity..." value={form.notes} rows={3}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <button
              onClick={generateDetailNotes}
              disabled={detailLoading || (!form.name && !form.category)}
              style={{
                marginTop: '6px', padding: '7px 14px', borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1))',
                border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px', width: 'fit-content',
                fontFamily: 'DM Sans, sans-serif',
                opacity: detailLoading ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!detailLoading) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.15))' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1))' }}
            >
              <Sparkles size={12} />
              {detailLoading ? 'AI soch raha hai...' : '✨ AI Detail Likho'}
            </button>
          </div>
          <div>
            <label style={labelStyle}>Tags</label>
            <TagInput
              tags={form.tags || []}
              onChange={tags => setForm(f => ({ ...f, tags }))}
              allTags={allTags}
              placeholder="Add tags..."
            />
          </div>
          <Button onClick={() => saveEntry(form)} disabled={!form.start || !form.end}>
            {editingEntry ? 'Update Entry' : 'Save Entry'}
          </Button>
        </div>
      </Modal>

      {/* ══ AI ANALYSE MODAL ═══════════════════════════════════ */}
      <Modal isOpen={showAIModal} onClose={() => { setShowAIModal(false); setAiResult(null); setFreeText(''); setIsSaved(false); clearDiaryImage(); }} title="✨ Day Analysis with AI">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Modal Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            <button
              onClick={() => { setAiResult(null); setAiModalTab('auto'); setIsSaved(false); }}
              style={{
                flex: 1, padding: '10px 6px', border: 'none', background: 'transparent',
                borderBottom: aiModalTab === 'auto' ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                color: aiModalTab === 'auto' ? 'var(--accent-indigo)' : 'var(--text-muted)',
                fontWeight: aiModalTab === 'auto' ? '700' : '400', fontSize: '12px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📊 Auto-Analyze
            </button>
            <button
              onClick={() => { setAiResult(null); setAiModalTab('text'); setIsSaved(false); }}
              style={{
                flex: 1, padding: '10px 6px', border: 'none', background: 'transparent',
                borderBottom: aiModalTab === 'text' ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                color: aiModalTab === 'text' ? 'var(--accent-indigo)' : 'var(--text-muted)',
                fontWeight: aiModalTab === 'text' ? '700' : '400', fontSize: '12px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ✍️ Text Parser
            </button>
            <button
              onClick={() => { setAiResult(null); setAiModalTab('photo'); setIsSaved(false); }}
              style={{
                flex: 1, padding: '10px 6px', border: 'none', background: 'transparent',
                borderBottom: aiModalTab === 'photo' ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                color: aiModalTab === 'photo' ? 'var(--accent-indigo)' : 'var(--text-muted)',
                fontWeight: aiModalTab === 'photo' ? '700' : '400', fontSize: '12px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📷 Diary Photo
            </button>
          </div>

          {aiModalTab === 'auto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dayEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>No timeline entries found for today</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Please log some activities in the timeline first, or use the "Plain Text Log Parser" tab to write them in prose.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', lineHeight: '1.6' }}>
                    Gemini AI will analyze your <strong>{dayEntries.length} timeline logs</strong> for {selectedDate} and suggest productivity improvements, identify habits, and give insights.
                  </div>
                  {!aiResult && (
                    <Button onClick={runAutoTimelineAnalysis} disabled={aiLoading}>
                      {aiLoading ? '⏳ Generating Performance Report...' : '✨ Generate AI Productivity Report'}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {aiModalTab === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', lineHeight: '1.6' }}>
                Write your day in plain language. AI will extract structured time entries automatically.
                <br /><br />
                <span style={{ color: 'var(--accent-amber)', fontWeight: '600' }}>Example:</span> "6am woke up, 6-6:30 meditation, 7-12 studied ML, 12-1 lunch and reels, 1-3 nap..."
              </div>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Write your entire day here..."
                rows={6}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                  fontFamily: 'DM Sans, sans-serif', resize: 'vertical', lineHeight: '1.6',
                }}
              />
              {!aiResult && (
                <Button onClick={analyseWithAI} disabled={aiLoading || !freeText.trim()}>
                  {aiLoading ? '⏳ Extracting timeline...' : '✨ Parse & Import with AI'}
                </Button>
              )}
            </div>
          )}

          {aiModalTab === 'photo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', lineHeight: '1.6' }}>
                📷 Upload a photo of your <strong>handwritten diary/schedule</strong> and AI will read your handwriting and extract time entries automatically.
                <br /><br />
                <span style={{ color: 'var(--accent-amber)', fontWeight: '600' }}>Works with:</span> Notebooks, daily planners, to-do lists, handwritten schedules in Hindi or English
              </div>

              {/* Hidden file input */}
              <input
                ref={diaryFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleDiaryImageSelect}
                style={{ display: 'none' }}
              />

              {!diaryImagePreview ? (
                /* Drag & Drop + Buttons Area */
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleDiaryFile(file);
                  }}
                  style={{
                    padding: '24px 16px',
                    borderRadius: '16px',
                    border: isDragging ? '2px dashed #10B981' : '2px dashed rgba(99,102,241,0.35)',
                    background: isDragging ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    background: isDragging ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isDragging ? '#10B981' : 'var(--accent-indigo)',
                  }}>
                    <Upload size={24} />
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {isDragging ? 'Drop photo here to upload!' : 'Drag & Drop photo or Paste (Ctrl + V)'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Notebook pages, handwritten notes, planners, or screenshots
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '360px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (diaryFileRef.current) {
                          diaryFileRef.current.setAttribute('capture', 'environment')
                          diaryFileRef.current.click()
                        }
                      }}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '10px',
                        border: '1px solid rgba(99,102,241,0.3)',
                        background: 'rgba(99,102,241,0.1)',
                        color: 'var(--accent-indigo)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Camera size={16} /> Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (diaryFileRef.current) {
                          diaryFileRef.current.removeAttribute('capture')
                          diaryFileRef.current.click()
                        }
                      }}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '10px',
                        border: '1px solid rgba(139,92,246,0.3)',
                        background: 'rgba(139,92,246,0.1)',
                        color: '#A78BFA',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <ImageIcon size={16} /> Choose File
                    </button>
                  </div>

                  <div style={{
                    fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)',
                    padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.08)'
                  }}>
                    📋 <strong>Tip:</strong> Copy any photo / screenshot to clipboard and press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl + V</kbd> to paste directly!
                  </div>
                </div>
              ) : (
                /* Image Preview */
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleDiaryFile(file);
                  }}
                  style={{
                    position: 'relative',
                    borderRadius: '12px',
                    outline: isDragging ? '2px dashed #10B981' : 'none',
                  }}
                >
                  <img
                    src={diaryImagePreview}
                    alt="Diary page"
                    style={{
                      width: '100%', maxHeight: '250px', objectFit: 'contain',
                      borderRadius: '12px', border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                    }}
                  />
                  <button
                    onClick={clearDiaryImage}
                    style={{
                      position: 'absolute', top: '8px', right: '8px',
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', border: 'none',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    ✕
                  </button>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)',
                  }}>
                    <span>{diaryImage?.name || 'Pasted Image'} · {((diaryImage?.size || 0) / 1024).toFixed(0)} KB</span>
                    <span style={{ color: 'var(--accent-indigo)', cursor: 'pointer', fontWeight: 600 }} onClick={() => diaryFileRef.current?.click()}>
                      Change Photo
                    </span>
                  </div>
                </div>
              )}

              {diaryImagePreview && !aiResult && (
                <Button onClick={processDiaryPhoto} disabled={diaryLoading}>
                  {diaryLoading ? '🔍 Reading your handwriting...' : '📷 Scan & Extract Entries'}
                </Button>
              )}

              {/* Transcribed Text */}
              {aiResult?.rawText && !aiResult.error && (
                <div style={{
                  padding: '12px', borderRadius: '10px',
                  background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📝 Transcribed Handwriting
                      {aiResult.confidence && (
                        <span style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                          background: aiResult.confidence === 'high' ? 'rgba(16,185,129,0.15)' : aiResult.confidence === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: aiResult.confidence === 'high' ? '#10B981' : aiResult.confidence === 'medium' ? '#F59E0B' : '#EF4444',
                        }}>
                          {aiResult.confidence} confidence
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiResult.rawText)
                        showToast('Transcribed handwriting copied! 📋', 'success')
                      }}
                      style={{
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: '6px', padding: '3px 8px', color: 'var(--accent-indigo)',
                        fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Copy size={11} /> Copy Text
                    </button>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {aiResult.rawText}
                  </div>
                </div>
              )}
            </div>
          )}

          {aiResult?.error && (
            <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px', fontSize: '13px', color: '#F43F5E' }}>
              ⚠️ {aiResult.message}
            </div>
          )}

          {aiResult && !aiResult.error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Day Score & Short Summary */}
              {(aiResult.dayScore || aiResult.shortSummary) && (
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ Quick Summary</div>
                    {aiResult.dayScore && (
                      <div style={{ fontSize: '11px', fontWeight: '800', background: 'var(--accent-indigo)', color: '#fff', padding: '3px 8px', borderRadius: '12px' }}>
                        SCORE: {aiResult.dayScore}/10
                      </div>
                    )}
                  </div>
                  {aiResult.shortSummary && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontStyle: 'italic' }}>
                      "{aiResult.shortSummary}"
                    </div>
                  )}
                </div>
              )}

              {/* Detailed Analysis */}
              {aiResult.detailedAnalysis && (
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>📊 Detailed Analysis</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {aiResult.detailedAnalysis}
                  </div>
                </div>
              )}

              {/* Daily Summary from Diary */}
              {aiResult.dailySummary && (
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>📊 Daily Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                    {aiResult.dailySummary.totalStudyHours !== undefined && (
                      <div style={{ padding: '8px', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-indigo)' }}>{aiResult.dailySummary.totalStudyHours}h</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Study</div>
                      </div>
                    )}
                    {aiResult.dailySummary.totalSleepHours !== undefined && (
                      <div style={{ padding: '8px', background: 'rgba(139,92,246,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#8B5CF6' }}>{aiResult.dailySummary.totalSleepHours}h</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sleep</div>
                      </div>
                    )}
                    {aiResult.dailySummary.totalWasteHours !== undefined && (
                      <div style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#EF4444' }}>{aiResult.dailySummary.totalWasteHours}h</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Waste</div>
                      </div>
                    )}
                    {aiResult.dailySummary.totalWaitHours !== undefined && (
                      <div style={{ padding: '8px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#F59E0B' }}>{aiResult.dailySummary.totalWaitHours}h</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Wait</div>
                      </div>
                    )}
                    {aiResult.dailySummary.totalMealsHours !== undefined && (
                      <div style={{ padding: '8px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10B981' }}>{aiResult.dailySummary.totalMealsHours}h</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Meals</div>
                      </div>
                    )}
                  </div>
                  {aiResult.dailySummary.userGoalNotes && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', fontStyle: 'italic' }}>
                      🎯 <strong>Your Goal:</strong> {aiResult.dailySummary.userGoalNotes}
                    </div>
                  )}
                </div>
              )}

              {/* Study Breakdown */}
              {aiResult.studyBreakdown?.length > 0 && (
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>📚 Study Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {aiResult.studyBreakdown.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{item.subject} {item.type === 'exam' ? '(Exam)' : ''}</span>
                        <span style={{ color: 'var(--accent-indigo)', fontWeight: 'bold' }}>{item.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waste Breakdown */}
              {aiResult.wasteBreakdown?.length > 0 && (
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>🗑️ Waste Time Analysis</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {aiResult.wasteBreakdown.map((item, i) => (
                      <div key={i} style={{ padding: '8px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px' }}>{item.activity}</span>
                          <span style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '13px' }}>{item.hours}h</span>
                        </div>
                        {item.reason && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}><strong>Why:</strong> {item.reason}</div>}
                        {item.suggestion && <div style={{ fontSize: '12px', color: '#10B981' }}><strong>Fix:</strong> {item.suggestion}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optimization Tips */}
              {aiResult.optimizationTips?.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>⚡ Optimization Tips</div>
                  {aiResult.optimizationTips.map((tip, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>• {tip}</div>
                  ))}
                </div>
              )}

              {/* Activities preview */}
              {(aiModalTab === 'text' || aiModalTab === 'photo') && aiResult.activities?.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Extracted {aiResult.activities?.length || 0} Activities
                    </div>
                    <button
                      onClick={() => {
                        const formatted = aiResult.activities.map(a => `${a.start} - ${a.end}: ${a.name} (${a.category})`).join('\n')
                        navigator.clipboard.writeText(formatted)
                        showToast('Extracted timeline copied! 📋', 'success')
                      }}
                      style={{
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: '6px', padding: '2px 8px', color: 'var(--accent-indigo)',
                        fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Copy size={11} /> Copy Timeline
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {aiResult.activities?.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: CATEGORY_COLORS[a.category] || '#6B7280', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{a.start}–{a.end}</span>
                        <span style={{ flex: 1, fontWeight: '600' }}>{a.name}</span>
                        {a.isWaste && <span style={{ fontSize: '11px', color: '#F43F5E' }}>waste</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tomorrow's Action Plan */}
              {aiResult.tomorrowActions?.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#EC4899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>🎯 Kal Se Ye Karo (Tomorrow's Action Plan)</div>
                  {aiResult.tomorrowActions.map((action, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>
                      {i + 1}. {action}
                    </div>
                  ))}
                </div>
              )}

              {/* Insights */}
              {aiResult.insights?.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>💡 AI Insights</div>
                  {aiResult.insights.map((insight, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>• {insight}</div>
                  ))}
                </div>
              )}

              {/* Good Habits */}
              {aiResult.goodHabits?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>✨ Good Habits Identified</div>
                  {aiResult.goodHabits.map((h, i) => <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>• {h}</div>)}
                </div>
              )}

              {/* Bad Habits */}
              {aiResult.badHabits?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>⚠️ Bad Habits / Time Wasters</div>
                  {aiResult.badHabits.map((h, i) => <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>• {h}</div>)}
                </div>
              )}

              {/* Suggestions */}
              {aiResult.suggestions?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🚀 Improvement Suggestions</div>
                  {aiResult.suggestions.map((s, i) => <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>• {s}</div>)}
                </div>
              )}

              {isSaved && (
                <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', textAlign: 'center', marginTop: '4px' }}>
                  💾 Automatically saved to Journal ✓
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(aiModalTab === 'text' || aiModalTab === 'photo') && aiResult.activities?.length > 0 ? (
                  <Button onClick={importAIEntries} style={{ flex: '1 1 140px' }}>✅ Import to Timeline</Button>
                ) : (
                  <Button onClick={() => { setShowAIModal(false); setAiResult(null); setIsSaved(false); clearDiaryImage(); }} style={{ flex: '1 1 100px' }}>Done</Button>
                )}
                <Button variant="secondary" onClick={() => {
                  let textToCopy = ''
                  if (aiResult.rawText) {
                    textToCopy += `--- Transcribed Diary ---\n${aiResult.rawText}\n\n`
                  }
                  if (aiResult.activities?.length) {
                    textToCopy += `--- Activities ---\n` + aiResult.activities.map(a => `${a.start} - ${a.end}: ${a.name} [${a.category}]`).join('\n') + '\n\n'
                  }
                  if (aiResult.shortSummary) {
                    textToCopy += `--- Summary ---\n${aiResult.shortSummary}\n\n`
                  }
                  if (aiResult.detailedAnalysis) {
                    textToCopy += `--- Analysis ---\n${aiResult.detailedAnalysis}\n\n`
                  }
                  if (aiResult.tomorrowActions?.length) {
                    textToCopy += `--- Action Plan ---\n` + aiResult.tomorrowActions.map((act, i) => `${i+1}. ${act}`).join('\n')
                  }
                  navigator.clipboard.writeText(textToCopy.trim())
                  showToast('All extracted details copied! 📋', 'success')
                }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Copy size={13} /> Copy All
                </Button>
                <Button variant="secondary" onClick={() => saveAnalysisToJournal(aiResult, selectedDate)} disabled={!aiResult || aiResult.error}>
                  💾 Save to Journal
                </Button>
                <Button variant="secondary" onClick={() => {
                  if (aiModalTab === 'auto') {
                    runAutoTimelineAnalysis()
                  } else if (aiModalTab === 'photo') {
                    processDiaryPhoto()
                  } else {
                    analyseWithAI()
                  }
                }}>
                  Re-analyse
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ══ AI QUICK ADD MODAL (Chat/Voice) ════════════════════ */}
      <Modal isOpen={showQuickAI} onClose={() => { setShowQuickAI(false); setIsListening(false); stopVoiceInput(); }} title="⚡ AI Quick Add — Bol ya Likh">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '420px' }}>

          {/* Info banner */}
          <div style={{
            padding: '10px 14px', borderRadius: '10px', fontSize: '12px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(236,72,153,0.08))',
            border: '1px solid rgba(99,102,241,0.2)',
            color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '10px',
          }}>
            🎤 <strong>Voice ya type karo</strong> — "mene 2 bje se 4 bje tk ML padha, phir 4 se 5 gym gaya" <br/>
            AI samajh ke automatically time entries bana dega ✨
          </div>

          {/* Chat area */}
          <div style={{
            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            gap: '8px', padding: '8px 2px', marginBottom: '10px',
            minHeight: 0,
          }}>
            {quickAIChatHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>💬</div>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>Bata kya kiya aaj?</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>e.g. "subah 6 bje utha, 7 se 9 padhai ki, 12 se 1 lunch"</div>
              </div>
            )}
            {quickAIChatHistory.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: '14px',
                  fontSize: '13px', lineHeight: '1.5',
                  ...(msg.role === 'user' ? {
                    background: 'var(--accent-indigo)',
                    color: '#fff',
                    borderBottomRightRadius: '4px',
                  } : {
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderBottomLeftRadius: '4px',
                  }),
                }}>
                  <div>{msg.text}</div>
                  {/* Show parsed entries preview */}
                  {msg.entries?.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {msg.entries.map((e, j) => (
                        <div key={j} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 10px', borderRadius: '8px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontSize: '12px',
                        }}>
                          <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: CATEGORY_COLORS[e.category] || '#6B7280', flexShrink: 0,
                          }} />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', opacity: 0.7 }}>
                            {e.start}–{e.end}
                          </span>
                          <span style={{ fontWeight: '600', flex: 1 }}>{e.name}</span>
                          <span style={{ opacity: 0.6, fontSize: '11px' }}>{e.category}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => saveQuickAIEntries(msg.entries)}
                        style={{
                          marginTop: '6px', padding: '8px 16px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, #10B981, #059669)',
                          border: 'none', color: '#fff', fontSize: '13px',
                          fontWeight: '700', cursor: 'pointer',
                          fontFamily: 'DM Sans, sans-serif',
                          transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(16,185,129,0.4)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        ✅ Save All Entries
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {quickAILoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 18px', borderRadius: '14px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderBottomLeftRadius: '4px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: 'var(--accent-indigo)',
                        animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AI soch raha hai...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'center',
            padding: '8px 0 0',
            borderTop: '1px solid var(--border)',
          }}>
            {/* Voice button */}
            <button
              onClick={isListening ? stopVoiceInput : startVoiceInput}
              style={{
                width: '42px', height: '42px', borderRadius: '50%', border: 'none',
                background: isListening
                  ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                  : 'linear-gradient(135deg, var(--accent-indigo), #7C3AED)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                animation: isListening ? 'voicePulse 1.5s ease-in-out infinite' : 'none',
                transition: 'all 0.2s',
              }}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Text input */}
            <input
              type="text"
              value={quickAIText}
              onChange={e => setQuickAIText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAISend() } }}
              placeholder={isListening ? '🎤 Bol raha hai...' : 'Bol ya likh — "2 se 4 ML padha"'}
              disabled={quickAILoading}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: isListening ? '2px solid #EF4444' : '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '14px',
                fontFamily: 'DM Sans, sans-serif', outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />

            {/* Send button */}
            <button
              onClick={handleQuickAISend}
              disabled={quickAILoading || !quickAIText.trim()}
              style={{
                width: '42px', height: '42px', borderRadius: '50%', border: 'none',
                background: quickAIText.trim()
                  ? 'linear-gradient(135deg, #3B82F6, #2563EB)'
                  : 'var(--bg-secondary)',
                color: quickAIText.trim() ? '#fff' : 'var(--text-muted)',
                cursor: quickAIText.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ AI TIME OPTIMIZER MODAL ════════════════════════════════ */}
      <Modal isOpen={showOptimizerModal} onClose={() => { setShowOptimizerModal(false); setOptimizerResult(null); setOptimizerSaved(false); }} title="🧠 AI Time Optimizer — Maximize Study Time">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {dayEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📭</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>No timeline entries for this day</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Pehle timeline me entries add kar, phir optimize kar.</div>
            </div>
          ) : !optimizerResult ? (
            <>
              <div style={{
                padding: '14px', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.08))',
                border: '1px solid rgba(139,92,246,0.2)',
                fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6',
              }}>
                <strong style={{ color: '#A78BFA' }}>🧠 Time Optimizer</strong> — AI tera poora din analyze karega aur batayega kaha kaha time bacha sakta hai taaki <strong>study time maximize</strong> ho. Har activity ke liye specific time targets milenge for tomorrow.
              </div>
              <Button onClick={runTimeOptimizer} disabled={optimizerLoading}
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: '#fff' }}>
                {optimizerLoading ? '⏳ Optimizing your day...' : '🧠 Optimize My Day'}
              </Button>
            </>
          ) : null}

          {optimizerResult?.error && (
            <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px', fontSize: '13px', color: '#F43F5E' }}>
              ⚠️ {optimizerResult.message}
            </div>
          )}

          {optimizerResult && !optimizerResult.error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Study Time Comparison */}
              <div style={{
                padding: '16px', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.08))',
                border: '1px solid rgba(59,130,246,0.2)',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={14} color="#3B82F6" /> Study Time Potential
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current</div>
                  <div style={{ height: '26px', borderRadius: '13px', background: 'rgba(59,130,246,0.12)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, ((optimizerResult.currentStudyMins || 0) / 720) * 100)}%`, background: 'linear-gradient(90deg, #3B82F6, #2563EB)', borderRadius: '13px', transition: 'width 1s ease' }} />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                      {((optimizerResult.currentStudyMins || 0) / 60).toFixed(1)}h
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#10B981', marginBottom: '4px', fontWeight: '600' }}>✨ Potential (After Optimization)</div>
                  <div style={{ height: '26px', borderRadius: '13px', background: 'rgba(16,185,129,0.12)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, ((optimizerResult.potentialStudyMins || 0) / 720) * 100)}%`, background: 'linear-gradient(90deg, #10B981, #059669)', borderRadius: '13px', transition: 'width 1s ease' }} />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                      {((optimizerResult.potentialStudyMins || 0) / 60).toFixed(1)}h
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '14px', fontWeight: '800', color: '#10B981' }}>
                  🚀 +{((optimizerResult.timeGainMins || 0) / 60).toFixed(1)}h more study time possible!
                </div>
              </div>

              {/* Flagged Activities */}
              {optimizerResult.flaggedActivities?.length > 0 && (
                <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    🚩 Flagged Activities — Time Savings
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                    {optimizerResult.flaggedActivities.map((a, i) => (
                      <div key={i} style={{
                        padding: '10px 12px', borderRadius: '10px',
                        background: a.flag === '🔴' ? 'rgba(239,68,68,0.06)' : a.flag === '🟡' ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
                        border: `1px solid ${a.flag === '🔴' ? 'rgba(239,68,68,0.2)' : a.flag === '🟡' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{a.flag || '🚩'}</span> {a.name}
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>({a.category})</span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: '#10B981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                            -{a.savingMins}min
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span style={{ color: '#EF4444', fontWeight: '600', fontFamily: 'JetBrains Mono, monospace' }}>{a.currentMins}min</span>
                          <span>→</span>
                          <span style={{ color: '#10B981', fontWeight: '600', fontFamily: 'JetBrains Mono, monospace' }}>{a.suggestedMins}min</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>💡 {a.tip}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Wins */}
              {optimizerResult.quickWins?.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>⚡ Quick Wins</div>
                  {optimizerResult.quickWins.map((w, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '3px' }}>• {w}</div>
                  ))}
                </div>
              )}

              {/* Tomorrow Schedule Tips */}
              {optimizerResult.tomorrowScheduleTips?.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>⏰ Tomorrow's Schedule Tips</div>
                  {optimizerResult.tomorrowScheduleTips.map((t, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '500' }}>{i + 1}. {t}</div>
                  ))}
                </div>
              )}

              {/* Optimized Day Plan */}
              {optimizerResult.optimizedDayPlan && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>🗓️ Optimized Day Plan</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{optimizerResult.optimizedDayPlan}</div>
                </div>
              )}

              {/* Motivational Note */}
              {optimizerResult.motivationalNote && (
                <div style={{
                  padding: '12px', borderRadius: '10px', textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06))',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}>
                  <div style={{ fontSize: '13px', color: '#A78BFA', fontWeight: '600', fontStyle: 'italic' }}>💪 {optimizerResult.motivationalNote}</div>
                </div>
              )}

              {/* Saved indicator */}
              {optimizerSaved && (
                <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', textAlign: 'center', padding: '4px 0' }}>
                  💾 Auto-saved to Journal as "How to Improve Next Day" ✓
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button onClick={() => { setShowOptimizerModal(false); setOptimizerResult(null); setOptimizerSaved(false); }} style={{ flex: 1 }}>Done</Button>
                <Button variant="secondary" onClick={() => saveOptimizerToJournal(optimizerResult, selectedDate)} disabled={!optimizerResult || optimizerResult.error}>
                  💾 Save to Journal
                </Button>
                <Button variant="secondary" onClick={runTimeOptimizer}>
                  Re-optimize
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Keyframe for dotPulse and voicePulse */}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes voicePulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70% { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>

    </div>
  )
}

// ── Timeline Entry Component ──────────────────────────────
function TimelineEntry({ entry, onDelete, onEdit, isLast, index }) {
  const color = CATEGORY_COLORS[entry.category] || '#6B7280'
  const hrs = (entry.durationMinutes / 60).toFixed(1)

  return (
    <div style={{
      display: 'flex', gap: '0', position: 'relative',
      animation: `fadeSlideIn 0.3s ease ${index * 0.05}s both`,
    }}>
      {/* Time column */}
      <div style={{ width: '60px', flexShrink: 0, paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', textAlign: 'right', paddingRight: '12px' }}>
          {entry.start}
        </div>
      </div>

      {/* Line + dot */}
      <div style={{ width: '20px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '12px', height: '12px', borderRadius: '50%', background: color,
          marginTop: '14px', flexShrink: 0, zIndex: 1,
          boxShadow: `0 0 8px ${color}60`,
        }} />
        {!isLast && <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '2px' }} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: '12px', paddingLeft: '10px' }}>
        <div style={{ padding: '10px 12px', background: `${color}12`, border: `1px solid ${color}30`, borderRadius: '10px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{entry.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
              <span style={{ color }}>{entry.category}</span>
              <span>• {entry.start}–{entry.end}</span>
              <span>• {hrs}h</span>
              {entry.isWaste && <span style={{ color: '#EF4444' }}>• waste ⚠️</span>}
            </div>
            {entry.notes && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{entry.notes}</div>}
            {entry.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                {entry.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      fontSize: '11px',
                      color: 'var(--accent-indigo)',
                      fontWeight: '600',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{ width: '6px', height: '6px', borderRadius: '50%', background: n <= entry.productivityScore ? color : 'var(--border)' }} />
            ))}
            <button
              type="button"
              onClick={() => onEdit?.(entry)}
              aria-label="Edit entry"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                padding: 8, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-indigo)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Pencil size={13} />
            </button>
            <ConfirmDeleteButton onConfirm={() => onDelete(entry.id)} size={13} label="Delete time entry" />
          </div>
        </div>
      </div>
    </div>
  )
}
