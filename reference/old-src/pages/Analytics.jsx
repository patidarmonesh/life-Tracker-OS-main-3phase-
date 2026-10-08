import { useMemo, useState } from 'react'
import { subDays, format } from 'date-fns'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Download, Sparkles, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useToast } from '../context/toastContextCore'
import { getGeminiApiKey, generateWeeklyReportAndBurnoutRisk } from '../services/geminiService'
import { playSuccessSound, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { formatCurrencyAmount, getCurrencySymbol, normalizeCurrency } from '../utils/currency'

const EMPTY_ARRAY = []

function pearsonCorrelation(xs, ys) {
  if (!xs.length || xs.length !== ys.length) return null
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)
  const sumY2 = ys.reduce((a, y) => a + y * y, 0)
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2))
  if (!denominator) return null
  return +(numerator / denominator).toFixed(2)
}

function normalizeScore(value, max) {
  if (!max) return 0
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)))
}

function downloadCSV(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((field) => {
          const value = row[field] ?? ''
          return `"${String(value).replace(/"/g, '""')}"`
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const MODULE_COLORS = {
  Finance: '#10B981',
  Study: '#3B82F6',
  Time: '#F59E0B',
  Habits: '#8B5CF6',
  Health: '#EC4899',
}

export default function Analytics() {
  const state = useAppState()
  const [range, setRange] = useState('monthly')
  const currencyCode = normalizeCurrency(state.settings?.profile?.currency)
  const currencySymbol = getCurrencySymbol(currencyCode)

  const expenses = state.finance?.expenses || EMPTY_ARRAY
  const studySessions = state.study?.sessions || EMPTY_ARRAY
  const timeEntries = state.timeflow?.entries || EMPTY_ARRAY
  const checkpoints = state.habits?.checkpoints || EMPTY_ARRAY
  const habitLogs = state.habits?.dailyLogs || EMPTY_ARRAY
  const bodyLogs = state.health?.bodyLogs || state.health?.manualLogs || EMPTY_ARRAY
  const journalEntries = state.journal?.entries || EMPTY_ARRAY

  const analytics = useMemo(() => {
    const now = new Date()
    const dayCount = range === 'weekly' ? 7 : range === 'yearly' ? 12 : 30

    const days = Array.from({ length: dayCount }, (_, i) => {
      if (range === 'yearly') {
        const d = new Date(now.getFullYear(), i, 1)
        return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM') }
      }
      const back = range === 'weekly' ? 6 : 29
      const d = subDays(now, back - i)
      return { key: format(d, 'yyyy-MM-dd'), label: format(d, range === 'weekly' ? 'EEE' : 'MMM d') }
    })

    const dailyData = days.map((day) => {
      const dateKey = day.key

      const dayExpenses = expenses.filter((e) => {
        if (range === 'yearly') return (e.date || '').slice(0, 7) === dateKey
        return e.date === dateKey
      })

      const dayStudy = studySessions.filter((s) => {
        if (range === 'yearly') return (s.date || '').slice(0, 7) === dateKey
        return s.date === dateKey
      })

      const dayTime = timeEntries.filter((t) => {
        if (range === 'yearly') return (t.date || '').slice(0, 7) === dateKey
        return t.date === dateKey
      })

      const dayJournal = journalEntries.filter((j) => {
        if (range === 'yearly') return (j.date || '').slice(0, 7) === dateKey
        return j.date === dateKey
      })

      const dayBody = bodyLogs.filter((h) => {
        if (range === 'yearly') return (h.date || '').slice(0, 7) === dateKey
        return h.date === dateKey
      })

      const spend = dayExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)
      const studyHours = +(dayStudy.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0) / 60).toFixed(1)
      const wasteHours = +(dayTime.filter((t) => t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60).toFixed(1)
      const productiveHours = +(dayTime.filter((t) => !t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60).toFixed(1)
      const avgMood = dayJournal.length ? +(dayJournal.reduce((a, j) => a + (Number(j.mood) || 0), 0) / dayJournal.length).toFixed(1) : 0
      const avgSleep = dayBody.filter((h) => h.sleepHours).length
        ? +(dayBody.reduce((a, h) => a + (Number(h.sleepHours) || 0), 0) / dayBody.filter((h) => h.sleepHours).length).toFixed(1)
        : 0
      const steps = dayBody.reduce((a, h) => a + (Number(h.steps) || 0), 0)

      let completedHabits = 0
      if (range === 'yearly') {
        habitLogs.forEach((log) => {
          if ((log.date || '').slice(0, 7) === dateKey && log.status === 'done') completedHabits += 1
        })
      } else {
        completedHabits = habitLogs.filter((log) => log.date === dateKey && log.status === 'done').length
      }

      const habitScore = checkpoints.length ? normalizeScore(completedHabits, checkpoints.length) : 0
      const financeScore = spend === 0 ? 100 : normalizeScore(Math.max(0, 3000 - spend), 3000)
      const studyScore = normalizeScore(studyHours, 6)
      const timeScore = normalizeScore(Math.max(0, productiveHours - wasteHours + 2), 8)
      const healthScore = Math.round(
        normalizeScore(steps, 10000) * 0.5 +
          normalizeScore(avgSleep || 0, 8) * 0.5
      )
      const lifeScore = Math.round(financeScore * 0.2 + studyScore * 0.25 + timeScore * 0.15 + habitScore * 0.2 + healthScore * 0.2)

      return {
        date: day.label,
        rawKey: dateKey,
        spend,
        studyHours,
        wasteHours,
        productiveHours,
        mood: avgMood,
        sleepHours: avgSleep,
        steps,
        completedHabits,
        financeScore,
        studyScore,
        timeScore,
        habitScore,
        healthScore,
        lifeScore,
      }
    })

    const totals = {
      spend: Math.round(dailyData.reduce((a, d) => a + d.spend, 0)),
      studyHours: +dailyData.reduce((a, d) => a + d.studyHours, 0).toFixed(1),
      wasteHours: +dailyData.reduce((a, d) => a + d.wasteHours, 0).toFixed(1),
      productiveHours: +dailyData.reduce((a, d) => a + d.productiveHours, 0).toFixed(1),
      avgLifeScore: Math.round(dailyData.reduce((a, d) => a + d.lifeScore, 0) / (dailyData.length || 1)),
      avgMood: +(dailyData.filter((d) => d.mood > 0).reduce((a, d) => a + d.mood, 0) / (dailyData.filter((d) => d.mood > 0).length || 1)).toFixed(1),
    }

    const radarData = [
      { metric: 'Finance', score: Math.round(dailyData.reduce((a, d) => a + d.financeScore, 0) / (dailyData.length || 1)) },
      { metric: 'Study', score: Math.round(dailyData.reduce((a, d) => a + d.studyScore, 0) / (dailyData.length || 1)) },
      { metric: 'Time', score: Math.round(dailyData.reduce((a, d) => a + d.timeScore, 0) / (dailyData.length || 1)) },
      { metric: 'Habits', score: Math.round(dailyData.reduce((a, d) => a + d.habitScore, 0) / (dailyData.length || 1)) },
      { metric: 'Health', score: Math.round(dailyData.reduce((a, d) => a + d.healthScore, 0) / (dailyData.length || 1)) },
    ]

    const corrPairs = [
      { label: 'Sleep vs study', r: pearsonCorrelation(dailyData.map((d) => d.sleepHours), dailyData.map((d) => d.studyHours)) },
      { label: 'Steps vs life score', r: pearsonCorrelation(dailyData.map((d) => d.steps), dailyData.map((d) => d.lifeScore)) },
      { label: 'Waste time vs spending', r: pearsonCorrelation(dailyData.map((d) => d.wasteHours), dailyData.map((d) => d.spend)) },
      { label: 'Habit completion vs life score', r: pearsonCorrelation(dailyData.map((d) => d.completedHabits), dailyData.map((d) => d.lifeScore)) },
    ].filter((item) => item.r !== null)

    return { dailyData, totals, radarData, corrPairs }
  }, [range, expenses, studySessions, timeEntries, checkpoints, habitLogs, bodyLogs, journalEntries])

  const tabStyle = (active) => ({
    padding: '8px 16px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--accent-indigo)' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400',
    fontSize: '13px',
    fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid var(--accent-indigo)' : '2px solid transparent',
  })

  const tooltipStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
  }

  const handleExport = () => {
    downloadCSV(`lifeos-analytics-${range}.csv`, analytics.dailyData)
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto' }}>
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>📊 Analytics</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Cross-module reports, life score trends, and correlation insights.
          </div>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download size={14} /> Export
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {[
          ['weekly', 'Weekly'],
          ['monthly', 'Monthly'],
          ['yearly', 'Yearly'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setRange(key)} style={tabStyle(range === key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Life Score', value: analytics.totals.avgLifeScore, color: '#6366F1', icon: '🎯' },
            { label: 'Study Hours', value: analytics.totals.studyHours, color: '#3B82F6', icon: '📘', suffix: 'h' },
            { label: 'Spent', value: formatCurrencyAmount(analytics.totals.spend, currencyCode), color: '#10B981', icon: currencySymbol },
            { label: 'Mood Avg', value: analytics.totals.avgMood || '—', color: '#F59E0B', icon: '🙂' },
          ].map((card) => (
            <Card key={card.label}>
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px' }}>{card.icon}</div>
                <div style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: card.color, marginTop: '6px' }}>
                  {card.value}{card.suffix || ''}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{card.label}</div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Life Score Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={analytics.dailyData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={80} stroke="#10B981" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="lifeScore" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: '#6366F1', r: 3 }} animationBegin={0} animationDuration={800} animationEasing="ease-out" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Study vs Waste Time</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.dailyData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="studyHours" fill="#3B82F6" radius={[4, 4, 0, 0]} animationBegin={0} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="wasteHours" fill="#F43F5E" radius={[4, 4, 0, 0]} animationBegin={100} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Module Scores</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.radarData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="metric" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}/100`, 'Score']} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={24} animationBegin={0} animationDuration={800} animationEasing="ease-out">
                  {analytics.radarData.map((entry) => (
                    <Cell key={entry.metric} fill={MODULE_COLORS[entry.metric] || '#6366F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Correlation Highlights</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {analytics.corrPairs.map((item) => {
              const strong = Math.abs(item.r) >= 0.5
              const positive = item.r > 0
              return (
                <div
                  key={item.label}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${strong ? (positive ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)') : 'var(--border)'}`,
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.label}</div>
                  <div style={{ marginTop: '6px', fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: strong ? (positive ? '#10B981' : '#F43F5E') : 'var(--text-secondary)' }}>
                    r = {item.r}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {Math.abs(item.r) >= 0.7 ? 'Strong' : Math.abs(item.r) >= 0.5 ? 'Moderate' : 'Weak'} {positive ? 'positive' : 'negative'} relationship
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* GitHub-style Habit Heatmap */}
        <Card>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>📅 Activity Heatmap (90 days)</h3>
          <HabitHeatmap habitLogs={habitLogs} checkpointCount={checkpoints.length} />
        </Card>

        {/* Month-over-Month Delta */}
        <Card>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>📈 Month-over-Month Change</h3>
          <MonthDeltas
            expenses={expenses}
            studySessions={studySessions}
            timeEntries={timeEntries}
            habitLogs={habitLogs}
            checkpointCount={checkpoints.length}
            currencyCode={currencyCode}
          />
        </Card>

        {/* Time-of-Day Productivity Curve */}
        <Card>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>🕐 Time-of-Day Productivity</h3>
          <ProductivityCurve timeEntries={timeEntries} studySessions={studySessions} />
        </Card>

        <AIBurnoutPredictor snapshot={analytics.dailyData.slice(-7)} />

        <Card>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Period Insight</h3>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            In this {range === 'weekly' ? 'week' : range === 'monthly' ? 'month' : 'year'}, your average Life Score is{' '}
            <span style={{ color: '#6366F1', fontWeight: '700' }}>{analytics.totals.avgLifeScore}</span>, with{' '}
            <span style={{ color: '#3B82F6', fontWeight: '700' }}>{analytics.totals.studyHours} hours</span> of study and{' '}
            <span style={{ color: '#10B981', fontWeight: '700' }}>{formatCurrencyAmount(analytics.totals.spend, currencyCode)}</span> spent.
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ── Habit Heatmap Component ────────────────────────────── */
function HabitHeatmap({ habitLogs, checkpointCount }) {
  const cells = useMemo(() => {
    const result = []
    const today = new Date()
    for (let i = 89; i >= 0; i--) {
      const d = subDays(today, i)
      const key = format(d, 'yyyy-MM-dd')
      const dayLogs = habitLogs.filter(l => l.date === key && l.status === 'done')
      const count = dayLogs.length
      const pct = checkpointCount > 0 ? count / checkpointCount : 0
      result.push({ key, dayOfWeek: d.getDay(), count, pct, label: format(d, 'MMM d') })
    }
    return result
  }, [habitLogs, checkpointCount])

  const weeks = useMemo(() => {
    const w = []
    let col = []
    // Pad first week
    if (cells.length > 0) {
      for (let i = 0; i < cells[0].dayOfWeek; i++) {
        col.push(null)
      }
    }
    cells.forEach(cell => {
      col.push(cell)
      if (col.length === 7) {
        w.push(col)
        col = []
      }
    })
    if (col.length > 0) w.push(col)
    return w
  }, [cells])

  function getColor(pct) {
    if (pct <= 0) return 'rgba(255,255,255,0.04)'
    if (pct < 0.25) return 'rgba(99,102,241,0.15)'
    if (pct < 0.5) return 'rgba(99,102,241,0.3)'
    if (pct < 0.75) return 'rgba(99,102,241,0.5)'
    if (pct < 1) return 'rgba(99,102,241,0.7)'
    return '#6366F1'
  }

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '3px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginRight: '4px', paddingTop: '0' }}>
          {dayLabels.map((d, i) => (
            <div key={i} style={{ width: '14px', height: '14px', fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {i % 2 === 1 ? d : ''}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {week.map((cell, ci) => (
              <div
                key={ci}
                title={cell ? `${cell.label}: ${cell.count} habits done` : ''}
                style={{
                  width: '14px', height: '14px', borderRadius: '3px',
                  background: cell ? getColor(cell.pct) : 'transparent',
                  transition: 'background 0.15s ease',
                  cursor: cell ? 'default' : 'auto',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Less</span>
        {[0, 0.15, 0.3, 0.5, 0.75, 1].map((v, i) => (
          <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', background: getColor(v) }} />
        ))}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  )
}

/* ── Month-over-Month Delta ─────────────────────────────── */
function MonthDeltas({ expenses, studySessions, timeEntries, habitLogs, checkpointCount, currencyCode }) {
  const deltas = useMemo(() => {
    const now = new Date()
    const thisMonth = format(now, 'yyyy-MM')
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = format(lastMonthDate, 'yyyy-MM')

    const thisSpend = expenses.filter(e => (e.date || '').startsWith(thisMonth)).reduce((a, e) => a + (Number(e.amount) || 0), 0)
    const lastSpend = expenses.filter(e => (e.date || '').startsWith(lastMonth)).reduce((a, e) => a + (Number(e.amount) || 0), 0)

    const thisStudy = studySessions.filter(s => (s.date || '').startsWith(thisMonth)).reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0) / 60
    const lastStudy = studySessions.filter(s => (s.date || '').startsWith(lastMonth)).reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0) / 60

    const thisWaste = timeEntries.filter(t => (t.date || '').startsWith(thisMonth) && t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60
    const lastWaste = timeEntries.filter(t => (t.date || '').startsWith(lastMonth) && t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60

    const thisDays = now.getDate()
    const lastDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate()

    function delta(curr, prev, currDays, prevDays) {
      const avgCurr = currDays > 0 ? curr / currDays : 0
      const avgPrev = prevDays > 0 ? prev / prevDays : 0
      if (avgPrev === 0) return null
      return Math.round(((avgCurr - avgPrev) / avgPrev) * 100)
    }

    return [
      { label: 'Spending', delta: delta(thisSpend, lastSpend, thisDays, lastDays), good: 'down', color: '#10B981' },
      { label: 'Study', delta: delta(thisStudy, lastStudy, thisDays, lastDays), good: 'up', color: '#3B82F6' },
      { label: 'Waste Time', delta: delta(thisWaste, lastWaste, thisDays, lastDays), good: 'down', color: '#F43F5E' },
    ]
  }, [expenses, studySessions, timeEntries])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
      {deltas.map(item => {
        const isGood = item.delta !== null && (
          (item.good === 'up' && item.delta > 0) ||
          (item.good === 'down' && item.delta < 0)
        )
        const arrow = item.delta > 0 ? '↑' : item.delta < 0 ? '↓' : '→'
        return (
          <div key={item.label} style={{
            padding: '14px', borderRadius: '12px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{item.label}</div>
            <div style={{
              fontSize: '22px', fontWeight: '800',
              fontFamily: 'JetBrains Mono, monospace',
              color: item.delta === null ? 'var(--text-muted)' : isGood ? '#10B981' : '#F43F5E',
            }}>
              {item.delta === null ? '—' : `${arrow}${Math.abs(item.delta)}%`}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              vs last month (daily avg)
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Time-of-Day Productivity Curve ─────────────────────── */
function ProductivityCurve({ timeEntries, studySessions }) {
  const hourData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      productive: 0,
      waste: 0,
      study: 0,
    }))

    timeEntries.forEach(entry => {
      const startTime = entry.startTime || entry.start
      if (!startTime) return
      const hourMatch = String(startTime).match(/(\d{1,2}):/)
      if (!hourMatch) return
      const h = parseInt(hourMatch[1], 10)
      if (h < 0 || h > 23) return
      const mins = Number(entry.durationMinutes) || 0
      if (entry.isWaste) {
        hours[h].waste += +(mins / 60).toFixed(1)
      } else {
        hours[h].productive += +(mins / 60).toFixed(1)
      }
    })

    studySessions.forEach(session => {
      const startTime = session.startTime || session.start
      if (!startTime) return
      const hourMatch = String(startTime).match(/(\d{1,2}):/)
      if (!hourMatch) return
      const h = parseInt(hourMatch[1], 10)
      if (h < 0 || h > 23) return
      const mins = Number(session.durationMinutes) || 0
      hours[h].study += +(mins / 60).toFixed(1)
    })

    return hours
  }, [timeEntries, studySessions])

  const tooltipStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
  }

  const peakHour = hourData.reduce((best, h, i) => {
    const total = h.productive + h.study
    return total > best.total ? { hour: i, total } : best
  }, { hour: 0, total: 0 })

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={hourData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={3} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="productive" stackId="1" fill="rgba(16,185,129,0.3)" stroke="#10B981" strokeWidth={2} />
          <Area type="monotone" dataKey="study" stackId="1" fill="rgba(59,130,246,0.3)" stroke="#3B82F6" strokeWidth={2} />
          <Area type="monotone" dataKey="waste" stackId="2" fill="rgba(244,63,94,0.2)" stroke="#F43F5E" strokeWidth={1.5} strokeDasharray="4 4" />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'Productive', color: '#10B981' },
          { label: 'Study', color: '#3B82F6' },
          { label: 'Waste', color: '#F43F5E' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>
      {peakHour.total > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          ⚡ Your most productive hour: <span style={{ color: '#10B981', fontWeight: 700 }}>{String(peakHour.hour).padStart(2, '0')}:00</span>
        </div>
      )}
    </div>
  )
}

function AIBurnoutPredictor({ snapshot }) {
  const [report, setReport] = useState(() => {
    try {
      const cached = localStorage.getItem('lifeos-cached-burnout-report')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  async function handleGenerate() {
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      showToast('Gemini API key is missing. Add it in Settings!', 'error')
      return
    }

    setLoading(true)
    showToast('Analyzing patterns & predicting burnout risk... 🧠', 'info')
    try {
      const res = await generateWeeklyReportAndBurnoutRisk({ apiKey, snapshot })
      if (res) {
        setReport(res)
        localStorage.setItem('lifeos-cached-burnout-report', JSON.stringify(res))
        showToast('AI analysis completed! ✨', 'success')
        playSuccessSound()
        hapticSuccess()
      } else {
        showToast('Failed to parse AI report.', 'error')
      }
    } catch (e) {
      showToast(e.message || 'AI prediction failed', 'error')
      playWarningBeep()
    } finally {
      setLoading(false)
    }
  }

  const riskColors = {
    Low: '#10B981',
    Medium: '#F59E0B',
    High: '#F97316',
    Critical: '#EF4444',
  }

  const riskColor = report ? riskColors[report.burnoutRisk] || '#6366F1' : '#6366F1'

  return (
    <Card style={{ padding: '18px', border: report ? `1px solid ${riskColor}40` : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          🧠 AI Weekly Report & Burnout Predictor
        </h3>
        <Button onClick={handleGenerate} disabled={loading} variant="secondary" style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'rgba(99,102,241,0.4)', color: '#C7D2FE' }}>
          <Sparkles size={13} className={loading ? 'animate-spin' : ''} style={{ marginRight: '4px' }} />
          {loading ? 'Analyzing...' : report ? 'Regenerate Analysis' : 'Analyze Burnout Risk'}
        </Button>
      </div>

      {report ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: `${riskColor}10`,
            border: `1px solid ${riskColor}30`,
            padding: '10px 14px',
            borderRadius: '10px'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Burnout Threat Level:</span>
            <span style={{
              fontSize: '14px',
              fontWeight: '800',
              color: riskColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {report.burnoutRisk === 'Critical' || report.burnoutRisk === 'High' ? '⚠️ ' : '✅ '}
              {report.burnoutRisk}
            </span>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Burnout Pattern Analysis</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>{report.burnoutAnalysis}</p>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Productivity & Focus Balance</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>{report.productivityReview}</p>
          </div>

          {report.suggestions && report.suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>AI Recommended Restorations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.suggestions.map((sug, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={14} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{sug}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
          No correlation analysis generated yet. Click above to run the Gemini Burnout Predictor on your last 7 days of steps, study hours, sleep and mood.
        </div>
      )}
    </Card>
  )
}
