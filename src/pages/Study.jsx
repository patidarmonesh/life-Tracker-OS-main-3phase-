import { useMemo, useRef, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppActions, useAppState } from '../context/appHooks'
import { subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, Pencil, Timer, CheckSquare, Sparkles, BookOpen, Award, AlertCircle, Calendar } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import EmptyState from '../components/ui/EmptyState'
import { useToast } from '../context/toastContextCore'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'
import { useSoundscape } from '../hooks/useSoundscape'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { getGeminiApiKey, generateStudyPlanWithAI } from '../services/geminiService'

const SUBJECTS = [
  'Mathematics', 'Physics', 'CS Theory', 'Machine Learning', 'Deep Learning',
  'DSA', 'Research Paper', 'Project Work', 'GATE Prep', 'Other'
]

const SUBJECT_COLORS = {
  'Mathematics': '#F59E0B', 'Physics': '#06B6D4', 'CS Theory': '#8B5CF6',
  'Machine Learning': '#10B981', 'Deep Learning': '#3B82F6',
  'DSA': '#F97316', 'Research Paper': '#EC4899',
  'Project Work': '#6366F1', 'GATE Prep': '#EF4444', 'Other': '#6B7280',
}

const FOCUS_TYPES = ['Deep Focus', 'Active Recall', 'Problem Solving', 'Reading', 'Revision', 'Lecture', 'Other']
const EMPTY_ARRAY = []

export default function Study() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const location = useLocation()
  const soundscape = useSoundscape()

  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const redirectDate = location.state?.selectedDate
  const [selectedDate, setSelectedDate] = useState(redirectDate || today)

  const subjects = state.study?.subjects?.length ? state.study.subjects : SUBJECTS
  const defaultSubject = subjects[0] || 'Other'
  const [activeTab, setActiveTab] = useState('log')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerRef = useRef(null)
  const [timerSubject, setTimerSubject] = useState(defaultSubject)
  const [timerFocusType, setTimerFocusType] = useState('Deep Focus')
  const [form, setForm] = useState({
    subject: defaultSubject, topic: '', focusType: 'Deep Focus',
    durationMinutes: 60, date: selectedDate, notes: '',
    rating: 3, pagesRead: 0, problemsSolved: 0, understood: true,
  })

  // Synchronize form date when selectedDate changes
  useEffect(() => {
    setForm(f => ({ ...f, date: selectedDate }))
  }, [selectedDate])

  const sessions = state.study?.sessions || EMPTY_ARRAY

  // ── Calculations ──────────────────────────────────────────
  const {
    todaySessions,
    todayMins,
    last7Days,
    totalHoursThisWeek,
    subjectTotals,
    streak,
  } = useMemo(() => {
    const sessionsByDate = new Map()
    const totalsBySubject = {}

    sessions.forEach(session => {
      const dateSessions = sessionsByDate.get(session.date) || []
      dateSessions.push(session)
      sessionsByDate.set(session.date, dateSessions)
      totalsBySubject[session.subject] =
        (totalsBySubject[session.subject] || 0) + (Number(session.durationMinutes) || 0)
    })

    const todaysSessions = sessionsByDate.get(selectedDate) || []
    const todaysMins = todaysSessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = toDateKey(subDays(new Date(), 6 - i), timezone)
      const mins = (sessionsByDate.get(date) || []).reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
      return { day: formatDateKey(date, timezone, { weekday: 'short' }), mins, hours: +(mins / 60).toFixed(1) }
    })

    let s = 0
    for (let i = 0; i < 30; i++) {
      const d = toDateKey(subDays(new Date(), i), timezone)
      if (sessionsByDate.has(d)) s++
      else break
    }

    return {
      todaySessions: todaysSessions,
      todayMins: todaysMins,
      last7Days: days,
      totalHoursThisWeek: +(days.reduce((a, d) => a + d.hours, 0)).toFixed(1),
      subjectTotals: totalsBySubject,
      streak: s,
    }
  }, [sessions, timezone, selectedDate])

  const dailyGoalMins = (state.settings?.goals?.dailyStudyHours || 6) * 60
  const goalPct = Math.min(100, (todayMins / dailyGoalMins) * 100)

  // ── Helper: Add session to TimeFlow ────────────────────
  function addToTimeFlow(session) {
    const mins = Number(session.durationMinutes) || 0
    if (mins < 1) return

    // Calculate approximate start/end time
    const endDate = session.createdAt ? new Date(session.createdAt) : new Date()
    const startDate = new Date(endDate.getTime() - mins * 60000)
    const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

    const timeEntry = {
      id: uuid(),
      date: session.date || today,
      start: startTime,
      end: endTime,
      durationMinutes: mins,
      name: `Study: ${session.subject}${session.topic ? ' — ' + session.topic : ''}`,
      category: 'Study',
      productivityScore: session.rating ?? 3,
      mood: 3,
      isWaste: false,
      isBadHabit: false,
      notes: session.focusType || '',
      source: 'study-sync',
      createdAt: new Date().toISOString(),
    }

    const timeflowEntries = state.timeflow?.entries || []
    setModule('timeflow', { ...state.timeflow, entries: [...timeflowEntries, timeEntry] })
    showToast('Added to TimeFlow ✓', 'success')
  }

  // ── Timer ─────────────────────────────────────────────────
  function startTimer() {
    setTimerRunning(true)
    timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    playSubtleClick()
    hapticLight()
  }

  function pauseTimer() {
    setTimerRunning(false)
    clearInterval(timerRef.current)
    playSubtleClick()
    hapticLight()
  }

  function stopAndSave() {
    clearInterval(timerRef.current)
    setTimerRunning(false)
    const mins = Math.floor(timerSeconds / 60)
    if (mins < 1) { alert('Session too short (< 1 min)'); return }
    const newSession = {
      id: uuid(), date: today,
      subject: timerSubject, topic: '',
      focusType: timerFocusType,
      durationMinutes: mins,
      notes: '', rating: 3, pagesRead: 0, problemsSolved: 0,
      source: 'timer', createdAt: new Date().toISOString(),
    }
    setModule('study', { ...state.study, sessions: [newSession, ...sessions] })
    setTimerSeconds(0)
    setShowTimerModal(false)
    showToast('Session saved ✓ — Add to TimeFlow?', 'info', {
      duration: 6000,
      undo: () => addToTimeFlow(newSession),
    })
    playSuccessSound()
    hapticSuccess()
  }

  function resetTimer() {
    clearInterval(timerRef.current)
    setTimerRunning(false)
    setTimerSeconds(0)
    playWarningBeep()
    hapticLight()
  }

  const formatTimer = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  function resetForm() {
    setForm({
      subject: defaultSubject, topic: '', focusType: 'Deep Focus',
      durationMinutes: 60, date: today, notes: '',
      rating: 3, pagesRead: 0, problemsSolved: 0, understood: true,
    })
  }

  function closeModal() {
    setShowAddModal(false)
    setEditingEntry(null)
    resetForm()
  }

  function startEdit(session) {
    setEditingEntry(session)
    setForm({
      subject: session.subject,
      topic: session.topic || '',
      focusType: session.focusType || 'Deep Focus',
      durationMinutes: session.durationMinutes,
      date: session.date,
      notes: session.notes || '',
      rating: session.rating ?? 3,
      pagesRead: session.pagesRead ?? 0,
      problemsSolved: session.problemsSolved ?? 0,
      understood: session.understood ?? true,
    })
    setShowAddModal(true)
  }

  function handleSave() {
    if (!form.durationMinutes || form.durationMinutes <= 0) return

    const payload = {
      ...form,
      durationMinutes: Number(form.durationMinutes),
      pagesRead: Number(form.pagesRead),
      problemsSolved: Number(form.problemsSolved),
      updatedAt: new Date().toISOString(),
    }

    if (editingEntry) {
      setModule('study', {
        ...state.study,
        sessions: sessions.map(s => (s.id === editingEntry.id ? { ...s, ...payload } : s)),
      })
      showToast('Session updated ✓', 'success')
    } else {
      const newSession = {
        id: uuid(),
        ...payload,
        source: 'manual',
        createdAt: new Date().toISOString(),
      }
      setModule('study', { ...state.study, sessions: [newSession, ...sessions] })
      showToast('Session saved ✓ — Add to TimeFlow?', 'info', {
        duration: 6000,
        undo: () => addToTimeFlow(newSession),
      })
    }

    closeModal()
  }

  function handleDelete(id) {
    const prev = sessions
    setModule('study', { ...state.study, sessions: sessions.filter(s => s.id !== id) })
    showToast('Session deleted', 'warning', {
      undo: () => setModule('study', { ...state.study, sessions: prev }),
    })
  }

  // ── Styles ────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }
  const labelStyle = {
    fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700',
    marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em',
  }
  const tabStyle = (active) => ({
    padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? '#3B82F6' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid #3B82F6' : '2px solid transparent',
  })

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>📚 Study Tracker</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setShowTimerModal(true)}>
            <Timer size={15} /> Start Timer
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Log Session
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {['log', 'stats', 'subjects', 'flashcards', 'courses', 'ai-planner'].map(tab => (
          <button key={tab} onClick={() => { playSubtleClick(); setActiveTab(tab); }} style={tabStyle(activeTab === tab)}>
            {tab === 'log' ? 'Today' : tab === 'stats' ? 'Stats' : tab === 'subjects' ? 'Subjects' : tab === 'flashcards' ? '🗂 Flashcards' : tab === 'courses' ? '📚 Courses' : '✨ AI Planner'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ══ TODAY / LOG TAB ════════════════════════════════ */}
        {activeTab === 'log' && <>
          {/* Inline Date Selector */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                outline: 'none',
              }}
            />
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'rgba(99,102,241,0.12)',
                  color: '#B9C2FF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Reset to Today
              </button>
            )}
          </div>

          {/* Today goal progress */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '34px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: '#3B82F6' }}>
                  {(todayMins / 60).toFixed(1)}h
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>studied today</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '700' }}>{Math.round(goalPct)}%</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>of {state.settings?.goals?.dailyStudyHours || 6}h goal</div>
              </div>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${goalPct}%`, background: goalPct >= 100 ? '#10B981' : '#3B82F6', borderRadius: '4px', transition: 'width 0.6s ease' }} />
            </div>

            {/* Quick stats row */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              {[
                { icon: '🔥', label: 'Streak', value: `${streak} days` },
                { icon: '📅', label: 'This Week', value: `${totalHoursThisWeek}h` },
                { icon: '📖', label: 'Sessions Today', value: todaySessions.length },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '18px' }}>{icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Today sessions */}
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>
              Session Logs
            </h3>
            {todaySessions.length === 0 ? (
              <EmptyState
                icon="📖"
                title="No sessions logged yet"
                subtitle="Start a timer or log a session manually to track your study hours."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todaySessions.map(s => <SessionRow key={s.id} session={s} onDelete={handleDelete} onEdit={startEdit} />)}
              </div>
            )}
          </Card>
        </>}

        {/* ══ STATS TAB ══════════════════════════════════════ */}
        {activeTab === 'stats' && <>
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>Daily Hours — Last 7 Days</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last7Days} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v}h`, 'Studied']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="hours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total Sessions', value: sessions.length, color: '#3B82F6' },
              { label: 'Total Hours', value: `${(sessions.reduce((a, s) => a + s.durationMinutes, 0) / 60).toFixed(1)}h`, color: '#10B981' },
              { label: 'Current Streak', value: `${streak} 🔥`, color: '#F59E0B' },
              { label: 'Daily Avg (7d)', value: `${(totalHoursThisWeek / 7).toFixed(1)}h`, color: '#8B5CF6' },
            ].map(({ label, value, color }) => (
              <Card key={label} style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
              </Card>
            ))}
          </div>

          {/* Recent sessions */}
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>Recent Sessions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {[...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map(s => (
                <SessionRow key={s.id} session={s} onDelete={handleDelete} onEdit={startEdit} showDate />
              ))}
            </div>
          </Card>
        </>}

        {/* ══ FLASHCARDS TAB ══════════════════════════════════ */}
        {activeTab === 'flashcards' && (
          <FlashcardsTabContent
            state={state}
            setModule={setModule}
            showToast={showToast}
          />
        )}

        {/* ══ COURSES TAB ════════════════════════════════════ */}
        {activeTab === 'courses' && (
          <CoursesTabContent
            state={state}
            setModule={setModule}
            showToast={showToast}
          />
        )}

        {/* ══ AI PLANNER TAB ══════════════════════════════════ */}
        {activeTab === 'ai-planner' && (
          <AIPlannerTabContent
            state={state}
            setModule={setModule}
            showToast={showToast}
          />
        )}

        {/* ══ SUBJECTS TAB ═══════════════════════════════════ */}
        {activeTab === 'subjects' && <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(subjectTotals).sort((a, b) => b[1] - a[1]).map(([subject, mins]) => {
              const maxMins = Math.max(...Object.values(subjectTotals))
              const pct = (mins / maxMins) * 100
              const color = SUBJECT_COLORS[subject] || '#6B7280'
              const subSessions = sessions.filter(s => s.subject === subject)
              return (
                <Card key={subject} style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
                      <span style={{ fontWeight: '700', fontSize: '14px' }}>{subject}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{(mins / 60).toFixed(1)}h</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{subSessions.length} sessions</div>
                    </div>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </Card>
              )
            })}
            {Object.keys(subjectTotals).length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>No subject data yet</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Log some study sessions first</div>
              </div>
            )}
          </div>
        </>}

      </div>

      {/* ══ LOG SESSION MODAL ══════════════════════════════════ */}
      <Modal isOpen={showAddModal} onClose={closeModal} title={editingEntry ? 'Edit Study Session' : 'Log Study Session'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Subject</label>
            <select style={inputStyle} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Topic / Task</label>
            <input style={inputStyle} placeholder="e.g. Backprop derivation, Chapter 4..." value={form.topic}
              onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Focus Type</label>
              <select style={inputStyle} value={form.focusType} onChange={e => setForm(f => ({ ...f, focusType: e.target.value }))}>
                {FOCUS_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Duration (mins)</label>
              <input style={inputStyle} type="number" inputMode="numeric" placeholder="60" value={form.durationMinutes}
                onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Pages Read</label>
              <input style={inputStyle} type="number" inputMode="numeric" placeholder="0" value={form.pagesRead}
                onChange={e => setForm(f => ({ ...f, pagesRead: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Problems Solved</label>
              <input style={inputStyle} type="number" inputMode="numeric" placeholder="0" value={form.problemsSolved}
                onChange={e => setForm(f => ({ ...f, problemsSolved: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Session Quality</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, rating: n }))} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                  borderColor: form.rating >= n ? '#3B82F6' : 'var(--border)',
                  background: form.rating >= n ? 'rgba(59,130,246,0.15)' : 'transparent',
                  cursor: 'pointer', fontSize: '16px', fontFamily: 'DM Sans, sans-serif',
                }}>
                  {['😫','😕','😐','🙂','🤩'][n-1]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <input style={inputStyle} placeholder="What did you learn / struggle with?" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button onClick={handleSave} disabled={!form.durationMinutes}>
            {editingEntry ? 'Update Session' : 'Save Session'}
          </Button>
        </div>
      </Modal>

      {/* ══ TIMER MODAL ════════════════════════════════════════ */}
      <Modal isOpen={showTimerModal} onClose={() => { if (!timerRunning) { resetTimer(); setShowTimerModal(false) } }} title="Study Timer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ ...labelStyle, textAlign: 'center' }}>Subject</label>
            <select style={inputStyle} value={timerSubject} onChange={e => setTimerSubject(e.target.value)}>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ width: '100%' }}>
            <label style={{ ...labelStyle, textAlign: 'center' }}>Focus Type</label>
            <select style={inputStyle} value={timerFocusType} onChange={e => setTimerFocusType(e.target.value)}>
              {FOCUS_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Big timer display */}
          <div style={{
            fontSize: '64px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '800',
            color: timerRunning ? '#10B981' : 'var(--text-primary)',
            padding: '24px 32px', background: 'var(--bg-secondary)', borderRadius: '16px',
            letterSpacing: '-2px', transition: 'color 0.3s',
          }}>
            {formatTimer(timerSeconds)}
          </div>

          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            {!timerRunning ? (
              <Button onClick={startTimer} style={{ flex: 1 }}>
                ▶ {timerSeconds > 0 ? 'Resume' : 'Start'}
              </Button>
            ) : (
              <Button variant="secondary" onClick={pauseTimer} style={{ flex: 1 }}>
                ⏸ Pause
              </Button>
            )}
            {timerSeconds > 0 && (
              <Button onClick={stopAndSave} style={{ flex: 1, background: '#10B981' }}>
                ✅ Stop & Save
              </Button>
            )}
            {timerSeconds > 0 && (
              <Button variant="secondary" onClick={resetTimer}>
                ↺
              </Button>
            )}
          </div>

          {timerSeconds > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {Math.floor(timerSeconds / 60)} min logged for <strong>{timerSubject}</strong>
            </div>
          )}

          {/* Ambient Soundscapes Widget */}
          <div style={{
            width: '100%',
            marginTop: '16px',
            padding: '14px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed var(--border)',
            borderRadius: '12px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎧 Ambient Focus Sounds
              </span>
              <button
                onClick={soundscape.togglePlay}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: soundscape.isPlaying ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                  color: soundscape.isPlaying ? '#10B981' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '700',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {soundscape.isPlaying ? '⏹ Stop' : '▶ Play'}
              </button>
            </div>
            
            {soundscape.isPlaying && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', animation: 'fadeSlideIn 0.2s ease' }}>
                {[
                  { key: 'brown', label: '🌋 Waterfall / Wind' },
                  { key: 'rain', label: '🌧️ Focus Rain' },
                  { key: 'beats', label: '🧠 Binaural Beats (6Hz)' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundscape.volumes[key]}
                      onChange={e => soundscape.adjustVolume(key, e.target.value)}
                      style={{ flex: 1, height: '4px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', width: '30px', textAlign: 'right' }}>
                      {Math.round(soundscape.volumes[key] * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

    </div>
  )
}

// ── Session Row ───────────────────────────────────────────
function SessionRow({ session: s, onDelete, onEdit, showDate = false }) {
  const color = SUBJECT_COLORS[s.subject] || '#6B7280'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
        📖
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{s.subject}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
          {s.topic && <span>{s.topic}</span>}
          {s.topic && <span>•</span>}
          <span style={{ color }}>{s.focusType}</span>
          {showDate && <><span>•</span><span>{s.date}</span></>}
          {s.problemsSolved > 0 && <><span>•</span><span>{s.problemsSolved} problems</span></>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{(s.durationMinutes / 60).toFixed(1)}h</div>
        <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end', marginTop: '2px' }}>
          {[1,2,3,4,5].map(n => (
            <div key={n} style={{ width: '5px', height: '5px', borderRadius: '50%', background: n <= s.rating ? color : 'var(--border)' }} />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onEdit?.(s)}
        aria-label="Edit session"
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
      <ConfirmDeleteButton onConfirm={() => onDelete(s.id)} size={13} label="Delete session" />
    </div>
  )
}

function FlashcardsTabContent({ state, setModule, showToast }) {
  const decks = state.study?.flashcards || []
  const [newDeckName, setNewDeckName] = useState('')
  const [selectedDeckId, setSelectedDeckId] = useState(null)
  
  const [isManagingCards, setIsManagingCards] = useState(false)
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')

  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)

  const selectedDeck = decks.find(d => d.id === selectedDeckId)

  function handleCreateDeck() {
    if (!newDeckName.trim()) return
    const newDeck = {
      id: 'deck_' + Date.now(),
      name: newDeckName.trim(),
      cards: [],
      createdAt: new Date().toISOString(),
    }
    setModule('study', {
      ...state.study,
      flashcards: [...decks, newDeck],
    })
    setNewDeckName('')
    showToast('Deck created! 🗂', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleDeleteDeck(deckId) {
    if (!window.confirm('Delete this deck and all its flashcards?')) return
    setModule('study', {
      ...state.study,
      flashcards: decks.filter(d => d.id !== deckId),
    })
    if (selectedDeckId === deckId) {
      setSelectedDeckId(null)
      setIsReviewing(false)
      setIsManagingCards(false)
    }
    showToast('Deck deleted', 'warning')
    playWarningBeep()
    hapticLight()
  }

  function handleAddCard() {
    if (!newFront.trim() || !newBack.trim()) return
    const newCard = {
      id: 'card_' + Date.now(),
      front: newFront.trim(),
      back: newBack.trim(),
      nextReviewDate: new Date().toISOString().slice(0, 10),
      intervalDays: 0,
      createdAt: new Date().toISOString(),
    }

    const updatedDecks = decks.map(d => {
      if (d.id !== selectedDeckId) return d
      return {
        ...d,
        cards: [...(d.cards || []), newCard]
      }
    })

    setModule('study', {
      ...state.study,
      flashcards: updatedDecks,
    })
    setNewFront('')
    setNewBack('')
    showToast('Card added! ✓', 'success')
    playSubtleClick()
    hapticLight()
  }

  function handleDeleteCard(cardId) {
    const updatedDecks = decks.map(d => {
      if (d.id !== selectedDeckId) return d
      return {
        ...d,
        cards: (d.cards || []).filter(c => c.id !== cardId)
      }
    })
    setModule('study', {
      ...state.study,
      flashcards: updatedDecks,
    })
    playWarningBeep()
    hapticLight()
  }

  function startReview(deck) {
    const todayStr = new Date().toISOString().slice(0, 10)
    const due = (deck.cards || []).filter(c => !c.nextReviewDate || c.nextReviewDate <= todayStr)
    
    if (due.length === 0) {
      showToast('Deck is clean! No cards due for review today. 🎉', 'success')
      playSuccessSound()
      return
    }

    setReviewQueue(due)
    setReviewIndex(0)
    setShowAnswer(false)
    setIsReviewing(true)
    playSubtleClick()
    hapticLight()
  }

  function handleAnkiRate(rating) {
    const card = reviewQueue[reviewIndex]
    let interval = 0
    if (rating === 'good') {
      interval = 2
    } else if (rating === 'easy') {
      interval = 4
    }

    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + interval)
    const nextDateStr = nextDate.toISOString().slice(0, 10)

    const updatedDecks = decks.map(d => {
      if (d.id !== selectedDeckId) return d
      const updatedCards = (d.cards || []).map(c => {
        if (c.id !== card.id) return c
        return {
          ...c,
          intervalDays: interval,
          nextReviewDate: nextDateStr,
        }
      })
      return { ...d, cards: updatedCards }
    })

    setModule('study', {
      ...state.study,
      flashcards: updatedDecks,
    })

    if (reviewIndex + 1 < reviewQueue.length) {
      setReviewIndex(reviewIndex + 1)
      setShowAnswer(false)
      playSubtleClick()
      hapticLight()
    } else {
      setIsReviewing(false)
      showToast('🏆 Review Session Complete! Excellent retention!', 'success')
      playSuccessSound()
      hapticSuccess()
    }
  }

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
      {isReviewing && reviewQueue[reviewIndex] ? (
        <Card style={{ padding: '24px', background: 'rgba(30,41,59,0.3)', border: '1px solid var(--accent-indigo)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reviewing Deck: <strong>{selectedDeck?.name}</strong></span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-indigo)', fontFamily: 'JetBrains Mono, monospace' }}>Card {reviewIndex + 1} / {reviewQueue.length}</span>
          </div>

          <div style={{
            minHeight: '160px',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            position: 'relative',
            cursor: 'pointer',
            overflow: 'hidden'
          }} onClick={() => setShowAnswer(s => !s)}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', position: 'absolute', top: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {showAnswer ? '💡 Answer (Click to see Question)' : '❓ Question (Click to reveal Answer)'}
            </div>
            
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: showAnswer ? '#E2E8F0' : '#F8FAFC',
              fontFamily: 'DM Sans, sans-serif'
            }}>
              {showAnswer ? reviewQueue[reviewIndex].back : reviewQueue[reviewIndex].front}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)} style={{ width: '100%', height: '42px' }}>
                Reveal Answer
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleAnkiRate('again')}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)',
                    color: '#FCA5A5',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Again ❌
                </button>
                <button
                  onClick={() => handleAnkiRate('good')}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid rgba(99,102,241,0.3)',
                    background: 'rgba(99,102,241,0.1)',
                    color: '#C7D2FE',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Good (2d) 👍
                </button>
                <button
                  onClick={() => handleAnkiRate('easy')}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid rgba(16,185,129,0.3)',
                    background: 'rgba(16,185,129,0.1)',
                    color: '#A7F3D0',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Easy (4d) 🚀
                </button>
              </div>
            )}
            <Button variant="secondary" onClick={() => setIsReviewing(false)} style={{ height: '36px', marginTop: '6px' }}>
              Exit Review
            </Button>
          </div>
        </Card>
      ) : isManagingCards && selectedDeck ? (
        <Card style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '15px' }}>🗂 Manage Deck: <strong>{selectedDeck.name}</strong></h4>
            <Button variant="secondary" onClick={() => setIsManagingCards(false)} style={{ padding: '4px 10px', fontSize: '12px' }}>
              Back to Decks
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-secondary)' }}>Add New Flashcard</div>
            <div>
              <label style={labelStyle}>Front side (Question)</label>
              <input
                style={inputStyle}
                placeholder="e.g. What is the time complexity of quicksort?"
                value={newFront}
                onChange={e => setNewFront(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Back side (Answer)</label>
              <input
                style={inputStyle}
                placeholder="e.g. O(n log n) average, O(n^2) worst case"
                value={newBack}
                onChange={e => setNewBack(e.target.value)}
              />
            </div>
            <Button onClick={handleAddCard} disabled={!newFront.trim() || !newBack.trim()} style={{ height: '36px', marginTop: '4px' }}>
              Add Flashcard
            </Button>
          </div>

          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Cards list ({selectedDeck.cards?.length || 0})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            {(selectedDeck.cards || []).map(card => (
              <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '700', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{card.front}</div>
                  <div style={{ color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }}>{card.back}</div>
                </div>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                >
                  ✕
                </button>
              </div>
            ))}
            {(selectedDeck.cards || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No cards in this deck yet.</div>
            )}
          </div>
        </Card>
      ) : (
        <>
          <Card style={{ padding: '18px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>
              🗂 Create Flashcard Deck
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                style={inputStyle}
                placeholder="e.g. Algorithms & Data Structures"
                value={newDeckName}
                onChange={e => setNewDeckName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateDeck() }}
              />
              <Button onClick={handleCreateDeck} disabled={!newDeckName.trim()}>
                Create
              </Button>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {decks.map(deck => {
              const todayStr = new Date().toISOString().slice(0, 10)
              const dueCount = (deck.cards || []).filter(c => !c.nextReviewDate || c.nextReviewDate <= todayStr).length

              return (
                <Card key={deck.id} style={{ padding: '16px', background: 'rgba(30,41,59,0.3)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>{deck.name}</h4>
                    <button
                      onClick={() => handleDeleteDeck(deck.id)}
                      style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Delete
                    </button>
                  </div>

                  <div style={{ margin: '14px 0 16px', display: 'flex', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-indigo)' }}>{(deck.cards || []).length}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>total cards</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: dueCount > 0 ? '#F59E0B' : '#10B981' }}>{dueCount}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>due today</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button
                      onClick={() => {
                        setSelectedDeckId(deck.id)
                        setIsManagingCards(true)
                      }}
                      variant="secondary"
                      style={{ flex: 1, padding: '6px', fontSize: '12px' }}
                    >
                      ⚙️ Manage
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedDeckId(deck.id)
                        startReview(deck)
                      }}
                      disabled={(deck.cards || []).length === 0}
                      style={{ flex: 1, padding: '6px', fontSize: '12px', background: dueCount > 0 ? 'var(--accent-indigo)' : 'var(--border-focus)' }}
                    >
                      📖 Review
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>

          {decks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px' }}>🗂</div>
              <div style={{ fontWeight: '600', marginTop: '6px' }}>No flashcard decks yet</div>
              <div style={{ fontSize: '12px' }}>Create a deck above and add cards to start study review.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CoursesTabContent({ state, setModule, showToast }) {
  const checklists = state.study?.checklists || []
  const subjects = state.study?.subjects?.length ? state.study.subjects : SUBJECTS
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || 'Other')
  const [newChapterText, setNewChapterText] = useState('')
  const [expandedSubject, setExpandedSubject] = useState(subjects[0] || '')

  function handleAddChapter() {
    if (!newChapterText.trim()) return
    const newItem = {
      id: 'chapter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      subject: selectedSubject,
      chapter: newChapterText.trim(),
      isCompleted: false,
      createdAt: new Date().toISOString()
    }
    setModule('study', {
      ...state.study,
      checklists: [...checklists, newItem]
    })
    setNewChapterText('')
    showToast('Chapter checklist item added! 📚', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleToggleChapter(id, currentVal) {
    const updated = checklists.map(item => {
      if (item.id !== id) return item
      const nextState = !currentVal
      if (nextState) {
        playSuccessSound()
        hapticSuccess()
      } else {
        playSubtleClick()
        hapticLight()
      }
      return { ...item, isCompleted: nextState }
    })
    setModule('study', {
      ...state.study,
      checklists: updated
    })
  }

  function handleDeleteChapter(id) {
    setModule('study', {
      ...state.study,
      checklists: checklists.filter(item => item.id !== id)
    })
    showToast('Chapter deleted', 'warning')
    playWarningBeep()
    hapticLight()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card style={{ padding: '16px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} color="var(--accent-indigo)" /> Add Chapter Checklist
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            style={{ width: '130px', padding: '8px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
          >
            {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
          <input
            style={{ flex: 1, padding: '8px 10px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
            placeholder="e.g. Chapter 1: Introduction to AI..."
            value={newChapterText}
            onChange={e => setNewChapterText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddChapter() }}
          />
          <Button onClick={handleAddChapter} disabled={!newChapterText.trim()}>Add</Button>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {subjects.map(subject => {
          const subjectItems = checklists.filter(c => c.subject === subject)
          const completedCount = subjectItems.filter(c => c.isCompleted).length
          const totalCount = subjectItems.length
          const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
          const isExpanded = expandedSubject === subject

          return (
            <Card key={subject} style={{ padding: '14px' }}>
              <div
                onClick={() => { playSubtleClick(); setExpandedSubject(isExpanded ? '' : subject); }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div>
                  <h4 style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>{subject}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{completedCount} / {totalCount} chapters completed ({pct}%)</span>
                </div>
                <div style={{ fontSize: '18px' }}>{isExpanded ? '▲' : '▼'}</div>
              </div>

              {totalCount > 0 && (
                <div style={{ height: '5px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10B981' : '#3B82F6', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                </div>
              )}

              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  {subjectItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div
                        onClick={() => handleToggleChapter(item.id, item.isCompleted)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: item.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}
                      >
                        <span style={{ fontSize: '16px' }}>{item.isCompleted ? '✅' : '⬜'}</span>
                        <span style={{ textDecoration: item.isCompleted ? 'line-through' : 'none' }}>{item.chapter}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteChapter(item.id)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {subjectItems.length === 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px' }}>
                      No chapters added yet for this subject.
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function AIPlannerTabContent({ state, setModule, showToast }) {
  const [examDate, setExamDate] = useState('')
  const [dailyHours, setDailyHours] = useState('6')
  const [aiLoading, setAiLoading] = useState(false)
  const subjects = state.study?.subjects?.length ? state.study.subjects : SUBJECTS

  // Saved plan inside study goals or state.study.aiPlan
  const savedPlan = state.study?.aiPlan || null

  async function handleGeneratePlan() {
    if (!examDate) {
      showToast('Please specify an Exam Date first!', 'warning')
      return
    }

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      showToast('Add your Gemini API key in Settings to use the AI Planner!', 'error')
      return
    }

    setAiLoading(true)
    try {
      showToast('AI Exam Planner is drafting your weekly revision calendar... ✍️', 'info')
      const plan = await generateStudyPlanWithAI({
        apiKey,
        examDate,
        subjects: subjects.join(', '),
        dailyHours,
      })

      if (plan?.weeklyMilestones || plan?.dailySchedule) {
        setModule('study', {
          ...state.study,
          aiPlan: plan
        })
        showToast('Study Plan generated successfully! ✨', 'success')
        playSuccessSound()
        hapticSuccess()
      } else {
        showToast('Could not parse layout structure. Try again.', 'error')
      }
    } catch (e) {
      showToast(e.message || 'AI planning failed', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card style={{ padding: '18px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={16} color="var(--accent-indigo)" /> AI Study & Exam Calendar Planner
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px', display: 'block' }}>EXAM DATE</label>
            <input
              type="date"
              style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px', display: 'block' }}>DAILY PREP HOURS</label>
            <input
              type="number"
              style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              placeholder="6"
              value={dailyHours}
              onChange={e => setDailyHours(e.target.value)}
            />
          </div>
        </div>

        <Button
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={handleGeneratePlan}
          disabled={aiLoading || !examDate}
        >
          <Sparkles size={14} className={aiLoading ? 'animate-pulse' : ''} />
          {aiLoading ? 'Decomposing study weeks with AI...' : 'Generate Exam Calendar Plan'}
        </Button>
      </Card>

      {savedPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Weekly targets */}
          {savedPlan.weeklyMilestones && (
            <Card style={{ padding: '16px' }}>
              <h4 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '13px', color: 'var(--accent-indigo)', marginBottom: '10px' }}>📅 Weekly Milestones Plan</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {savedPlan.weeklyMilestones.map((wm, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
                    <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>{wm.week}</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {wm.targets?.map((t, tIdx) => <li key={tIdx}>{t}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Daily recommends */}
          {savedPlan.dailySchedule && (
            <Card style={{ padding: '16px' }}>
              <h4 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '13px', color: 'var(--accent-cyan)', marginBottom: '10px' }}>⏱️ Daily Recommended Schedule</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {savedPlan.dailySchedule.map((ds, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', padding: '8px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div>
                      <strong style={{ color: 'var(--text-secondary)' }}>{ds.day}</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{ds.topic}</span>
                    </div>
                    <span style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>{ds.hours}h</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tips */}
          {savedPlan.tips && (
            <Card style={{ padding: '16px', background: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <h4 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '13px', color: '#34D399', marginBottom: '8px' }}>💡 AI Revision Tips</h4>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {savedPlan.tips.map((tip, idx) => <li key={idx}>{tip}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
