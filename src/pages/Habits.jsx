import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { format, subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { Plus, Check, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { formatDateKey, getMonthDays, getTodayDateKey, shiftMonth, toDateKey } from '../utils/dateTime'

const HABIT_ICONS = ['💪', '📚', '💧', '🧘', '🏃', '🥗', '😴', '✍️', '🎯', '🚫', '💊', '🧠', '🌿', '🛁', '📵']
const HABIT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#F97316', '#06B6D4', '#EF4444', '#6366F1', '#84CC16']
const CATEGORIES = ['Health', 'Fitness', 'Study', 'Mindfulness', 'Nutrition', 'Sleep', 'Social', 'Other']

export default function Habits() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const [activeTab, setActiveTab] = useState('today')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingHabit, setEditingHabit] = useState(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewedMonth, setViewedMonth] = useState(new Date())
  const [form, setForm] = useState({ name: '', icon: '🎯', color: '#10B981', category: 'Health', notes: '' })

  const habits = (state.habits?.checkpoints || []).filter(h => h.isActive !== false)
  const dailyLogs = state.habits?.dailyLogs || []

  const monthDays = useMemo(() => getMonthDays(viewedMonth, timezone), [viewedMonth, timezone])

  function isCompleted(habitId, date) {
    return dailyLogs.some(log => log.checkpointId === habitId && log.date === date && log.status === 'done')
  }

  function toggleHabit(habitId, date) {
    const existingIndex = dailyLogs.findIndex(log => log.checkpointId === habitId && log.date === date)
    let nextLogs

    if (existingIndex >= 0) {
      const existing = dailyLogs[existingIndex]
      if (existing.status === 'done') {
        nextLogs = dailyLogs.filter((_, idx) => idx !== existingIndex)
      } else {
        nextLogs = dailyLogs.map((log, idx) =>
          idx === existingIndex
            ? { ...log, status: 'done', loggedAt: new Date().toISOString() }
            : log
        )
      }
    } else {
      nextLogs = [
        ...dailyLogs,
        {
          id: uuid(),
          checkpointId: habitId,
          date,
          status: 'done',
          value: null,
          note: '',
          loggedAt: new Date().toISOString(),
        },
      ]
    }

    setModule('habits', {
      ...state.habits,
      checkpoints: habits,
      dailyLogs: nextLogs,
    })
  }

  function closeModal() {
    setShowAddModal(false)
    setEditingHabit(null)
    setForm({ name: '', icon: '🎯', color: '#10B981', category: 'Health', notes: '' })
  }

  function startEdit(habit) {
    setEditingHabit(habit)
    setForm({
      name: habit.title || habit.name || '',
      icon: habit.icon || '🎯',
      color: habit.color || '#10B981',
      category: habit.category || 'Health',
      notes: habit.description || habit.notes || '',
    })
    setShowAddModal(true)
  }

  function saveHabit() {
    if (!form.name.trim()) return

    const payload = {
      title: form.name.trim(),
      icon: form.icon,
      color: form.color,
      category: form.category,
      description: form.notes,
      updatedAt: new Date().toISOString(),
    }

    if (editingHabit) {
      setModule('habits', {
        ...state.habits,
        checkpoints: habits.map(h =>
          h.id === editingHabit.id ? { ...h, ...payload } : h
        ),
        dailyLogs,
      })
      showToast('Habit updated ✓', 'success')
    } else {
      const newHabit = {
        id: uuid(),
        ...payload,
        type: 'daily',
        priority: 'medium',
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      setModule('habits', {
        ...state.habits,
        checkpoints: [...habits, newHabit],
        dailyLogs,
      })
      showToast('Habit created ✓', 'success')
    }

    closeModal()
  }

  function deleteHabit(id) {
    const prevCheckpoints = habits
    const prevLogs = dailyLogs
    setModule('habits', {
      ...state.habits,
      checkpoints: habits.filter(h => h.id !== id),
      dailyLogs: dailyLogs.filter(log => log.checkpointId !== id),
    })
    showToast('Habit deleted', 'warning', {
      undo: () => setModule('habits', {
        ...state.habits,
        checkpoints: prevCheckpoints,
        dailyLogs: prevLogs,
      }),
    })
  }

  function getStreak(habitId) {
    let streak = 0
    for (let i = 0; i < 365; i += 1) {
      const key = toDateKey(subDays(new Date(), i), timezone)
      if (isCompleted(habitId, key)) streak += 1
      else break
    }
    return streak
  }

  function getLast7(habitId) {
    return Array.from({ length: 7 }, (_, i) => {
      const dateObj = subDays(new Date(), 6 - i)
      const dateKey = toDateKey(dateObj, timezone)
      return {
        date: dateKey,
        day: formatDateKey(dateKey, timezone, { weekday: 'short' }),
        done: isCompleted(habitId, dateKey),
      }
    })
  }

  const getHabitTitle = habit => habit.title || habit.name || 'Untitled Habit'

  const todayDone = habits.filter(h => isCompleted(h.id, selectedDate)).length
  const todayPct = habits.length > 0 ? Math.round((todayDone / habits.length) * 100) : 0

  const tabStyle = (active, color = '#10B981') => ({
    padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? color : 'var(--text-muted)',
    fontWeight: active ? '700' : '400', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
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
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>✅ Habits</h1>
        <Button onClick={() => setShowAddModal(true)}><Plus size={16} /> New Habit</Button>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)' }}>
        {['today', 'streaks', 'heatmap'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab === 'today' ? 'Today' : tab === 'streaks' ? 'Streaks' : 'Heatmap'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeTab === 'today' && <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: todayPct === 100 ? '#10B981' : todayPct >= 60 ? '#F59E0B' : 'var(--text-primary)' }}>
                  {todayDone}/{habits.length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>habits completed</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', fontSize: '13px', padding: '7px 12px' }} />
                <div style={{ fontSize: '12px', color: todayPct === 100 ? '#10B981' : 'var(--text-muted)' }}>
                  {todayPct === 100 ? '🎉 Perfect day!' : `${todayPct}% done`}
                </div>
              </div>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${todayPct}%`, background: todayPct === 100 ? '#10B981' : '#F59E0B', borderRadius: '4px', transition: 'width 0.6s ease' }} />
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {habits.map(habit => {
              const done = isCompleted(habit.id, selectedDate)
              const streak = getStreak(habit.id)
              return (
                <div key={habit.id} onClick={() => toggleHabit(habit.id, selectedDate)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                  borderRadius: '14px', cursor: 'pointer',
                  background: done ? `${habit.color || '#10B981'}15` : 'var(--bg-card)',
                  border: `1px solid ${done ? `${habit.color || '#10B981'}50` : 'var(--border)'}`,
                  transition: 'all 0.2s',
                  opacity: done ? 1 : 0.85,
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: done ? (habit.color || '#10B981') : 'var(--bg-secondary)',
                    border: `2px solid ${done ? (habit.color || '#10B981') : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', color: '#fff',
                  }}>
                    {done ? <Check size={16} /> : null}
                  </div>

                  <div style={{ fontSize: '22px', flexShrink: 0 }}>{habit.icon || '🎯'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: done ? (habit.color || '#10B981') : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', textDecorationColor: habit.color || '#10B981' }}>
                      {getHabitTitle(habit)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {habit.category || 'Other'} {streak > 0 && `• 🔥 ${streak} day streak`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {streak >= 7 && (
                      <div style={{ fontSize: '12px', fontWeight: '800', color: habit.color || '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                        {streak}🔥
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); startEdit(habit) }}
                      aria-label="Edit habit"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        padding: 8, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <div onClick={e => e.stopPropagation()}>
                      <ConfirmDeleteButton onConfirm={() => deleteHabit(habit.id)} size={13} label="Delete habit" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>}

        {activeTab === 'streaks' && <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {habits.map(habit => {
              const streak = getStreak(habit.id)
              const last7 = getLast7(habit.id)
              const completionRate = Math.round((last7.filter(d => d.done).length / 7) * 100)
              return (
                <Card key={habit.id} style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '24px' }}>{habit.icon || '🎯'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700' }}>{getHabitTitle(habit)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{habit.category || 'Other'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: habit.color || '#10B981' }}>{streak}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>day streak 🔥</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '50px' }}>Last 7d</span>
                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                      {last7.map(({ date, day, done }) => (
                        <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: done ? (habit.color || '#10B981') : 'var(--bg-secondary)', border: `1px solid ${done ? (habit.color || '#10B981') : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {done && <Check size={12} color="#fff" />}
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{day[0]}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: completionRate >= 80 ? '#10B981' : completionRate >= 50 ? '#F59E0B' : '#F43F5E', marginLeft: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {completionRate}%
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </>}

        {activeTab === 'heatmap' && <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setViewedMonth(m => shiftMonth(m, -1, timezone))}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{format(viewedMonth, 'MMMM yyyy')}</div>
              <button
                onClick={() => setViewedMonth(m => shiftMonth(m, 1, timezone))}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {habits.map(habit => {
              const completedCount = monthDays.filter(day => isCompleted(habit.id, day.dateKey)).length
              const monthLength = monthDays.length
              return (
                <Card key={habit.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{habit.icon || '🎯'}</span>
                      <span style={{ fontWeight: '700', fontSize: '14px' }}>{getHabitTitle(habit)}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{completedCount}/{monthLength} days</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {monthDays.map(({ dateKey, dayLabel, weekdayLabel }) => {
                      const done = isCompleted(habit.id, dateKey)
                      return (
                        <div
                          key={dateKey}
                          title={`${weekdayLabel}, ${dateKey}`}
                          style={{
                            height: '28px',
                            borderRadius: '6px',
                            background: done ? (habit.color || '#10B981') : 'var(--bg-secondary)',
                            border: `1px solid ${done ? `${habit.color || '#10B981'}80` : 'var(--border)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '10px',
                            color: done ? '#fff' : 'var(--text-muted)',
                          }}
                          onClick={() => toggleHabit(habit.id, dateKey)}
                        >
                          {dayLabel}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <div style={{ height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(completedCount / monthLength) * 100}%`, background: habit.color || '#10B981', borderRadius: '2px' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {Math.round((completedCount / monthLength) * 100)}% completion rate this month
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </>}
      </div>

      <Modal isOpen={showAddModal} onClose={closeModal} title={editingHabit ? 'Edit Habit' : 'New Habit'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Habit Name</label>
            <input style={inputStyle} placeholder="e.g. Meditate for 10 mins" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Icon</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {HABIT_ICONS.map(icon => (
                <button key={icon} onClick={() => setForm(f => ({ ...f, icon }))}
                  style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1px solid', fontSize: '20px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    borderColor: form.icon === icon ? 'var(--accent-indigo)' : 'var(--border)',
                    background: form.icon === icon ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                  }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {HABIT_COLORS.map(color => (
                <button key={color} onClick={() => setForm(f => ({ ...f, color }))}
                  style={{ width: '30px', height: '30px', borderRadius: '50%', background: color, border: `3px solid ${form.color === color ? 'var(--text-primary)' : 'transparent'}`, cursor: 'pointer' }} />
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input style={inputStyle} placeholder="Why is this habit important?" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: `${form.color}15`, border: `1px solid ${form.color}40`, borderRadius: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: form.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={16} color="#fff" />
            </div>
            <span style={{ fontSize: '22px' }}>{form.icon}</span>
            <span style={{ fontWeight: '700', color: form.color }}>{form.name || 'Your habit name'}</span>
          </div>

          <Button onClick={saveHabit} disabled={!form.name.trim()}>
            {editingHabit ? 'Update Habit' : 'Create Habit ✅'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
