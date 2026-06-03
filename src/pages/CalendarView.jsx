import { useMemo, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths, isSameDay, isToday } from 'date-fns'
import { useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getTodayDateKey, formatDateKey } from '../utils/dateTime'

const MODULE_COLORS = {
  expense: '#F43F5E',
  study: '#3B82F6',
  timeflow: '#10B981',
  habit: '#8B5CF6',
  journal: '#F59E0B',
  health: '#06B6D4',
}

const MODULE_EMOJIS = {
  expense: '💸',
  study: '📚',
  timeflow: '⏱️',
  habit: '✅',
  journal: '📝',
  health: '💪',
}

export default function CalendarView() {
  const state = useAppState()
  const timezone = state.settings?.profile?.timezone
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  // Build a map of date → events
  const eventsByDate = useMemo(() => {
    const map = {}

    function addEvent(dateStr, type, title, detail) {
      if (!dateStr) return
      const key = dateStr.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push({ type, title, detail })
    }

    // Expenses
    ;(state.finance?.expenses || []).forEach(e => {
      addEvent(e.date, 'expense', e.description || e.category, `₹${e.amount}`)
    })

    // Study sessions
    ;(state.study?.sessions || []).forEach(s => {
      const hours = ((s.durationMinutes || 0) / 60).toFixed(1)
      addEvent(s.date, 'study', s.subject, `${hours}h`)
    })

    // TimeFlow entries
    ;(state.timeflow?.entries || []).forEach(e => {
      const hours = ((e.durationMinutes || 0) / 60).toFixed(1)
      addEvent(e.date, 'timeflow', e.activity, `${hours}h${e.isWaste ? ' ⚠️' : ''}`)
    })

    // Habits
    const checkpoints = state.habits?.checkpoints || []
    const habitLogs = state.habits?.logs || {}
    Object.entries(habitLogs).forEach(([dateKey, dayLog]) => {
      const doneCount = Object.values(dayLog).filter(v => v === 'done').length
      if (doneCount > 0) {
        addEvent(dateKey, 'habit', `${doneCount}/${checkpoints.length} habits`, `${Math.round(doneCount / Math.max(1, checkpoints.length) * 100)}%`)
      }
    })

    // Journal
    ;(state.journal?.entries || []).forEach(e => {
      const mood = e.mood ? `Mood: ${e.mood}/5` : ''
      addEvent(e.date, 'journal', e.title || 'Entry', mood)
    })

    // Health
    ;(state.health?.bodyLogs || []).forEach(l => {
      const parts = []
      if (l.steps) parts.push(`${l.steps} steps`)
      if (l.sleepHours) parts.push(`${l.sleepHours}h sleep`)
      if (l.weight) parts.push(`${l.weight} kg`)
      if (parts.length > 0) {
        addEvent(l.date, 'health', parts[0], parts.slice(1).join(', '))
      }
    })

    return map
  }, [state])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    const startDay = getDay(start)
    const blanks = Array.from({ length: startDay }, (_, i) => ({ blank: true, key: `b-${i}` }))
    const dayEntries = days.map(d => ({
      date: d,
      key: format(d, 'yyyy-MM-dd'),
      events: eventsByDate[format(d, 'yyyy-MM-dd')] || [],
      isToday: isToday(d),
    }))
    return [...blanks, ...dayEntries]
  }, [currentMonth, eventsByDate])

  const selectedEvents = selectedDate ? (eventsByDate[format(selectedDate, 'yyyy-MM-dd')] || []) : []

  return (
    <div className="page-enter" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem' }}>
          📅 Calendar
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            style={navBtnStyle}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px',
            color: 'var(--text-primary)', minWidth: '140px', textAlign: 'center',
          }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            style={navBtnStyle}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
        marginBottom: '4px',
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '11px', fontWeight: 700,
            color: 'var(--text-muted)', padding: '8px 0',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
      }}>
        {calendarDays.map(day => {
          if (day.blank) {
            return <div key={day.key} style={{ minHeight: '80px' }} />
          }

          const isSelected = selectedDate && isSameDay(day.date, selectedDate)
          const hasEvents = day.events.length > 0
          const uniqueTypes = [...new Set(day.events.map(e => e.type))]

          return (
            <div
              key={day.key}
              onClick={() => setSelectedDate(day.date)}
              style={{
                minHeight: '80px',
                padding: '6px',
                borderRadius: '10px',
                border: isSelected ? '2px solid var(--accent-indigo)' : '1px solid var(--border)',
                background: isSelected
                  ? 'rgba(99,102,241,0.08)'
                  : day.isToday
                    ? 'rgba(16,185,129,0.06)'
                    : 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <div style={{
                fontSize: '13px', fontWeight: day.isToday ? 800 : 600,
                color: day.isToday ? '#10B981' : 'var(--text-primary)',
                marginBottom: '4px',
              }}>
                {format(day.date, 'd')}
              </div>

              {/* Event dots */}
              {hasEvents && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {uniqueTypes.slice(0, 4).map(type => (
                    <div key={type} style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: MODULE_COLORS[type],
                      flexShrink: 0,
                    }} title={type} />
                  ))}
                  {day.events.length > 4 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      +{day.events.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '14px', marginTop: '12px',
        justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {Object.entries(MODULE_COLORS).map(([key, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {key}
            </span>
          </div>
        ))}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <Card style={{ marginTop: '16px' }}>
          <h3 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px',
            marginBottom: '12px',
          }}>
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>

          {selectedEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>🌿</div>
              <div style={{ fontSize: '13px' }}>Nothing logged on this day</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedEvents.map((event, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '18px' }}>{MODULE_EMOJIS[event.type]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {event.title}
                    </div>
                    {event.detail && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {event.detail}
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: '3px 8px', borderRadius: '6px', fontSize: '10px',
                    fontWeight: 700, textTransform: 'uppercase',
                    background: `${MODULE_COLORS[event.type]}22`,
                    color: MODULE_COLORS[event.type],
                  }}>
                    {event.type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

const navBtnStyle = {
  background: 'rgba(99,102,241,0.1)',
  border: '1px solid rgba(129,140,248,0.2)',
  borderRadius: '10px',
  padding: '8px',
  cursor: 'pointer',
  color: 'var(--accent-indigo)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
