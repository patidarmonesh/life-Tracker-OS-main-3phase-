import { useMemo, useState } from 'react'
import { subDays, startOfMonth, startOfYear, format } from 'date-fns'
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ReferenceLine,
} from 'recharts'
import { Download } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { formatCurrencyAmount, getCurrencySymbol, normalizeCurrency } from '../utils/currency'

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

function getRangeStart(range) {
  const now = new Date()
  if (range === 'weekly') return subDays(now, 6)
  if (range === 'monthly') return startOfMonth(now)
  if (range === 'yearly') return startOfYear(now)
  return subDays(now, 29)
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

export default function Analytics() {
  const { state } = useApp()
  const [range, setRange] = useState('monthly')
  const currencyCode = normalizeCurrency(state.settings?.profile?.currency)
  const currencySymbol = getCurrencySymbol(currencyCode)

  const expenses = state.finance?.expenses || []
  const studySessions = state.study?.sessions || []
  const timeEntries = state.timeflow?.entries || []
  const checkpoints = state.habits?.checkpoints || []
  const habitLogs = state.habits?.dailyLogs || []
  const bodyLogs = state.health?.manualLogs || []
  const journalEntries = state.journal?.entries || []

  const analytics = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const yearStart = startOfYear(now)

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
      const avgMood = dayJournal.length ? +(dayJournal.reduce((a, j) => a + (Number(j.dayRating) || 0), 0) / dayJournal.length).toFixed(1) : 0
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
            <Card key={card.label} style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>{card.icon}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: card.color, marginTop: '6px' }}>
                {card.value}{card.suffix || ''}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{card.label}</div>
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
              <Line type="monotone" dataKey="lifeScore" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: '#6366F1', r: 3 }} />
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
                <Bar dataKey="studyHours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wasteHours" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Module Scores</h3>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={analytics.radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar name="Score" dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.35} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
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
