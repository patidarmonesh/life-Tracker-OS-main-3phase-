import { useMemo } from 'react'
import { subDays, format, startOfWeek, endOfWeek } from 'date-fns'
import Card from './Card'
import { calcLifeScore } from '../../utils/scoreCalculator'
import { toDateKey } from '../../utils/dateTime'
import { formatCurrencyAmount } from '../../utils/currency'

function getWeekDateKeys(referenceDate, timezone) {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return toDateKey(d, timezone)
  })
}

function buildDaySnapshot(state, dateKey) {
  const habits = state?.habits || { checkpoints: [], dailyLogs: [] }
  const study = state?.study || { sessions: [] }
  const finance = state?.finance || { expenses: [] }
  const timeflow = state?.timeflow || { entries: [] }
  const journal = state?.journal || { entries: [] }

  const checkpoints = (habits.checkpoints || []).filter(c => c.isActive)
  const dayLogs = (habits.dailyLogs || []).filter(l => l.date === dateKey)
  const habitsCompleted = dayLogs.filter(l => l.status === 'done').length

  const daySessions = (study.sessions || []).filter(s => s.date === dateKey)
  const studyMins = daySessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)

  const dayExpenses = (finance.expenses || []).filter(e => e.date === dateKey)
  const spend = dayExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)

  const dayEntries = (timeflow.entries || []).filter(e => e.date === dateKey)
  const productiveMins = dayEntries
    .filter(e => !e.isWaste)
    .reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)

  const journalEntries = (journal.entries || []).filter(e => e.date === dateKey)

  // Build a minimal state for score calc for this specific day
  const dayState = {
    ...state,
    habits: { ...habits, dailyLogs: dayLogs },
    study: { ...study, sessions: daySessions },
    finance: { ...finance, expenses: dayExpenses },
    timeflow: { ...timeflow, entries: dayEntries },
    journal: { ...journal, entries: journalEntries },
  }

  // Override getTodayDateKey behavior by injecting the dateKey
  let lifeScore = 50
  try {
    const scores = calcLifeScore({ ...dayState, _overrideDateKey: dateKey })
    lifeScore = scores.total
  } catch {
    lifeScore = 50
  }

  return {
    dateKey,
    spend,
    studyMins,
    productiveMins,
    habitsCompleted,
    totalCheckpoints: checkpoints.length,
    journalCount: journalEntries.length,
    lifeScore,
  }
}

function pctDelta(current, previous) {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100
  return Math.round(((current - previous) / previous) * 100)
}

function DeltaBadge({ delta }) {
  if (delta === 0) return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
  const up = delta > 0
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        color: up ? '#34D399' : '#FB7185',
      }}
    >
      {up ? '↑' : '↓'}{Math.abs(delta)}%
    </span>
  )
}

function MiniSparkline({ values }) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 210
  const h = 48
  const padY = 6

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - padY - ((v - min) / range) * (h - padY * 2)
    return { x, y, v }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818CF8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${points[points.length - 1].x.toFixed(1)} ${h} L ${points[0].x.toFixed(1)} ${h} Z`}
        fill="url(#sparkGrad)"
      />
      <path d={pathD} fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#1E1B4B" stroke="#818CF8" strokeWidth="2" />
      ))}
    </svg>
  )
}

const MOTIVATIONAL_LINES = {
  great: [
    "Incredible week - you showed up every single day. 🔥",
    "You're on a tear. Keep this momentum rolling! 💪",
    "Consistency king. This is how legends are built. 🏆",
  ],
  good: [
    "Solid week! A few tweaks and next week will be even better. 📈",
    "Good progress - you're building real momentum here. ✨",
    "Strong foundations this week. Keep stacking wins! 🧱",
  ],
  okay: [
    "Not bad, not great - the perfect setup for a breakout next week. 🌱",
    "Room to grow, and that's exciting. Let's push harder. 💡",
    "Every week can't be perfect - what matters is you keep going. 🔄",
  ],
  rough: [
    "Tough week, but you're still tracking. That counts for a lot. 🫶",
    "Reset and come back swinging. Next week is a blank canvas. 🎨",
    "Bad weeks build character. You got this. 💎",
  ],
}

function getMotivationalLine(avgScore) {
  const tier = avgScore >= 75 ? 'great' : avgScore >= 55 ? 'good' : avgScore >= 35 ? 'okay' : 'rough'
  const lines = MOTIVATIONAL_LINES[tier]
  return lines[Math.floor(Math.random() * lines.length)]
}

export default function WeeklySummary({ state }) {
  const timezone = state?.settings?.profile?.timezone
  const currency = state?.settings?.profile?.currency || 'INR'

  const { thisWeek, prevWeek, weekLabel, stats, prevStats, bestDay, worstDay, dailyScores, motivationalLine } =
    useMemo(() => {
      const now = new Date()
      const thisWeekKeys = getWeekDateKeys(now, timezone)
      const prevWeekStart = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7)
      const prevWeekKeys = getWeekDateKeys(prevWeekStart, timezone)

      const thisSnaps = thisWeekKeys.map(dk => buildDaySnapshot(state, dk))
      const prevSnaps = prevWeekKeys.map(dk => buildDaySnapshot(state, dk))

      const ws = startOfWeek(now, { weekStartsOn: 1 })
      const we = endOfWeek(now, { weekStartsOn: 1 })
      const label = `${format(ws, 'MMM d')} – ${format(we, 'MMM d')}`

      const sum = (arr, fn) => arr.reduce((a, s) => a + fn(s), 0)

      const thisStats = {
        totalSpend: sum(thisSnaps, s => s.spend),
        studyHours: +(sum(thisSnaps, s => s.studyMins) / 60).toFixed(1),
        productiveHours: +(sum(thisSnaps, s => s.productiveMins) / 60).toFixed(1),
        habitsCompleted: sum(thisSnaps, s => s.habitsCompleted),
        journalEntries: sum(thisSnaps, s => s.journalCount),
        avgScore: Math.round(sum(thisSnaps, s => s.lifeScore) / thisSnaps.length),
      }

      const pStats = {
        totalSpend: sum(prevSnaps, s => s.spend),
        studyHours: +(sum(prevSnaps, s => s.studyMins) / 60).toFixed(1),
        productiveHours: +(sum(prevSnaps, s => s.productiveMins) / 60).toFixed(1),
        habitsCompleted: sum(prevSnaps, s => s.habitsCompleted),
        journalEntries: sum(prevSnaps, s => s.journalCount),
        avgScore: Math.round(sum(prevSnaps, s => s.lifeScore) / prevSnaps.length),
      }

      const best = thisSnaps.reduce((a, b) => (b.lifeScore > a.lifeScore ? b : a), thisSnaps[0])
      const worst = thisSnaps.reduce((a, b) => (b.lifeScore < a.lifeScore ? b : a), thisSnaps[0])

      return {
        thisWeek: thisWeekKeys,
        prevWeek: prevWeekKeys,
        weekLabel: label,
        stats: thisStats,
        prevStats: pStats,
        bestDay: best,
        worstDay: worst,
        dailyScores: thisSnaps.map(s => s.lifeScore),
        motivationalLine: getMotivationalLine(thisStats.avgScore),
      }
    }, [state, timezone])

  const statCards = [
    {
      label: 'Total Spend',
      value: formatCurrencyAmount(stats.totalSpend, currency),
      delta: pctDelta(stats.totalSpend, prevStats.totalSpend),
      icon: '💸',
      invertColor: true,
    },
    {
      label: 'Study Hours',
      value: `${stats.studyHours}h`,
      delta: pctDelta(stats.studyHours, prevStats.studyHours),
      icon: '📚',
    },
    {
      label: 'Productive Hrs',
      value: `${stats.productiveHours}h`,
      delta: pctDelta(stats.productiveHours, prevStats.productiveHours),
      icon: '⚡',
    },
    {
      label: 'Habits Done',
      value: String(stats.habitsCompleted),
      delta: pctDelta(stats.habitsCompleted, prevStats.habitsCompleted),
      icon: '✅',
    },
    {
      label: 'Journal Entries',
      value: String(stats.journalEntries),
      delta: pctDelta(stats.journalEntries, prevStats.journalEntries),
      icon: '📝',
    },
    {
      label: 'Life Score Avg',
      value: String(stats.avgScore),
      delta: pctDelta(stats.avgScore, prevStats.avgScore),
      icon: '🎯',
    },
  ]

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div
      style={{
        borderRadius: '24px',
        padding: '24px',
        background:
          'radial-gradient(circle at top left, rgba(99,102,241,0.12), transparent 40%), rgba(15,23,42,0.55)',
        border: '1px solid rgba(148,163,184,0.12)',
        boxShadow: '0 16px 48px rgba(2,6,23,0.24)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeSlideIn 0.4s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(129,140,248,0.18)',
              color: '#B9C2FF',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              marginBottom: '10px',
            }}
          >
            📊 Week in Review
          </div>
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Your Week in Review
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{weekLabel}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '22px',
        }}
      >
        {statCards.map(({ label, value, delta, icon, invertColor }) => {
          const deltaColor = invertColor
            ? delta > 0
              ? '#FB7185'
              : '#34D399'
            : delta > 0
            ? '#34D399'
            : '#FB7185'
          return (
            <div
              key={label}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(148,163,184,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-primary)',
                }}
              >
                {value}
              </div>
              <div style={{ marginTop: '4px' }}>
                <DeltaBadge delta={invertColor ? -delta : delta} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>vs last week</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sparkline */}
      <div
        style={{
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(148,163,184,0.08)',
          marginBottom: '18px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>
          Daily Life Scores
        </div>
        <MiniSparkline values={dailyScores} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 2px' }}>
          {dayNames.map((d, i) => (
            <span
              key={d}
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                textAlign: 'center',
                width: '30px',
              }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Best / Worst Day */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
        <div
          style={{
            padding: '14px',
            borderRadius: '14px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#6EE7B7', fontWeight: 700, marginBottom: '4px' }}>
            🏆 Best Day
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#34D399',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {bestDay ? format(new Date(bestDay.dateKey + 'T00:00:00'), 'EEE, MMM d') : '—'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Score: {bestDay?.lifeScore ?? 0}
          </div>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '14px',
            background: 'rgba(251,113,133,0.08)',
            border: '1px solid rgba(251,113,133,0.18)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#FCA5A5', fontWeight: 700, marginBottom: '4px' }}>
            📉 Worst Day
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#FB7185',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {worstDay ? format(new Date(worstDay.dateKey + 'T00:00:00'), 'EEE, MMM d') : '—'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Score: {worstDay?.lifeScore ?? 0}
          </div>
        </div>
      </div>

      {/* Motivational Line */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(139,92,246,0.08))',
          border: '1px solid rgba(129,140,248,0.14)',
          fontSize: '14px',
          fontWeight: 600,
          color: '#C7D2FE',
          lineHeight: 1.6,
          textAlign: 'center',
        }}
      >
        {motivationalLine}
      </div>
    </div>
  )
}
