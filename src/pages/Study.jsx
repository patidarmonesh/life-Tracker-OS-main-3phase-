import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, Pencil, Timer } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'

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
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)
  const subjects = state.study?.subjects?.length ? state.study.subjects : SUBJECTS
  const defaultSubject = subjects[0] || 'Other'
  const [activeTab, setActiveTab] = useState('log')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerInterval, setTimerInterval] = useState(null)
  const [timerSubject, setTimerSubject] = useState(defaultSubject)
  const [timerFocusType, setTimerFocusType] = useState('Deep Focus')
  const [form, setForm] = useState({
    subject: defaultSubject, topic: '', focusType: 'Deep Focus',
    durationMinutes: 60, date: today, notes: '',
    rating: 3, pagesRead: 0, problemsSolved: 0, understood: true,
  })

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

    const todaysSessions = sessionsByDate.get(today) || []
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
  }, [sessions, timezone, today])

  const dailyGoalMins = (state.settings?.goals?.dailyStudyHours || 6) * 60
  const goalPct = Math.min(100, (todayMins / dailyGoalMins) * 100)

  // ── Timer ─────────────────────────────────────────────────
  function startTimer() {
    setTimerRunning(true)
    const interval = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    setTimerInterval(interval)
  }

  function pauseTimer() {
    setTimerRunning(false)
    clearInterval(timerInterval)
  }

  function stopAndSave() {
    clearInterval(timerInterval)
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
  }

  function resetTimer() {
    clearInterval(timerInterval)
    setTimerRunning(false)
    setTimerSeconds(0)
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
      showToast('Session saved ✓', 'success')
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
      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)' }}>
        {['log', 'stats', 'subjects'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab === 'log' ? 'Today' : tab === 'stats' ? 'Stats' : 'Subjects'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ══ TODAY / LOG TAB ════════════════════════════════ */}
        {activeTab === 'log' && <>

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
              Today's Sessions
            </h3>
            {todaySessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📖</div>
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '15px' }}>No sessions logged yet</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Start a timer or log a session manually</div>
              </div>
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
