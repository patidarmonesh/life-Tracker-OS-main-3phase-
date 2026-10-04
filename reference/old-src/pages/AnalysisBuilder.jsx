import { useMemo, useState } from 'react'
import { subDays, format, startOfWeek, startOfMonth } from 'date-fns'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

const EMPTY_ARRAY = []

const DOMAINS = [
  { value: 'finance', label: 'Finance', color: '#10B981' },
  { value: 'study', label: 'Study', color: '#3B82F6' },
  { value: 'timeflow', label: 'TimeFlow', color: '#F59E0B' },
  { value: 'habits', label: 'Habits', color: '#8B5CF6' },
  { value: 'health', label: 'Health', color: '#EC4899' },
  { value: 'journal', label: 'Journal', color: '#6366F1' },
]

const METRICS_BY_DOMAIN = {
  finance: [
    { value: 'totalSpend', label: 'Total Spend' },
    { value: 'avgSpend', label: 'Average Spend' },
    { value: 'categoryBreakdown', label: 'Category Breakdown' },
  ],
  study: [
    { value: 'totalHours', label: 'Total Hours' },
    { value: 'avgHours', label: 'Average Hours' },
    { value: 'subjectBreakdown', label: 'Subject Breakdown' },
  ],
  timeflow: [
    { value: 'productiveHours', label: 'Productive Hours' },
    { value: 'wasteHours', label: 'Waste Hours' },
    { value: 'categoryBreakdown', label: 'Category Breakdown' },
  ],
  habits: [
    { value: 'completionRate', label: 'Completion Rate' },
    { value: 'streakLength', label: 'Streak Length' },
  ],
  health: [
    { value: 'steps', label: 'Steps' },
    { value: 'sleep', label: 'Sleep' },
    { value: 'weight', label: 'Weight' },
  ],
  journal: [
    { value: 'mood', label: 'Mood' },
    { value: 'entryCount', label: 'Entry Count' },
  ],
}

const TIME_RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'This Year' },
]

const CHART_TYPES = ['Line', 'Bar', 'Pie']

const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const PIE_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6',
  '#8B5CF6', '#F43F5E', '#14B8A6', '#EAB308', '#A855F7',
  '#06B6D4', '#D946EF', '#84CC16', '#FB923C',
]

function isBreakdownMetric(metric) {
  return metric === 'categoryBreakdown' || metric === 'subjectBreakdown'
}

function getDomainColor(domain) {
  return DOMAINS.find((d) => d.value === domain)?.color || '#6366F1'
}

export default function AnalysisBuilder() {
  const state = useAppState()

  const [domain, setDomain] = useState('finance')
  const [metric, setMetric] = useState('totalSpend')
  const [range, setRange] = useState(30)
  const [chartType, setChartType] = useState('Line')
  const [groupBy, setGroupBy] = useState('day')

  const expenses = state.finance?.expenses || EMPTY_ARRAY
  const studySessions = state.study?.sessions || EMPTY_ARRAY
  const timeEntries = state.timeflow?.entries || EMPTY_ARRAY
  const checkpoints = state.habits?.checkpoints || EMPTY_ARRAY
  const habitLogs = state.habits?.dailyLogs || EMPTY_ARRAY
  const bodyLogs = state.health?.manualLogs || state.health?.bodyLogs || EMPTY_ARRAY
  const journalEntries = state.journal?.entries || EMPTY_ARRAY

  function handleDomainChange(newDomain) {
    setDomain(newDomain)
    const firstMetric = METRICS_BY_DOMAIN[newDomain]?.[0]?.value || ''
    setMetric(firstMetric)
    if (isBreakdownMetric(firstMetric)) {
      setChartType('Pie')
    }
  }

  function handleMetricChange(newMetric) {
    setMetric(newMetric)
    if (isBreakdownMetric(newMetric) && chartType !== 'Pie') {
      setChartType('Pie')
    } else if (!isBreakdownMetric(newMetric) && chartType === 'Pie') {
      setChartType('Bar')
    }
  }

  const showGroupBy = !isBreakdownMetric(metric)

  const chartData = useMemo(() => {
    const now = new Date()
    const startDate = subDays(now, range - 1)

    // Generate all days in range
    const days = []
    for (let i = 0; i < range; i++) {
      const d = subDays(now, range - 1 - i)
      days.push({
        date: format(d, 'yyyy-MM-dd'),
        dateObj: d,
      })
    }

    // --- Breakdown metrics (return pie data) ---
    if (isBreakdownMetric(metric)) {
      if (domain === 'finance' && metric === 'categoryBreakdown') {
        const rangeExpenses = expenses.filter(
          (e) => e.date >= format(startDate, 'yyyy-MM-dd') && e.date <= format(now, 'yyyy-MM-dd')
        )
        const buckets = {}
        rangeExpenses.forEach((e) => {
          const cat = e.category || 'Other'
          buckets[cat] = (buckets[cat] || 0) + (Number(e.amount) || 0)
        })
        return Object.entries(buckets)
          .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
          .sort((a, b) => b.value - a.value)
      }

      if (domain === 'study' && metric === 'subjectBreakdown') {
        const rangeSessions = studySessions.filter(
          (s) => s.date >= format(startDate, 'yyyy-MM-dd') && s.date <= format(now, 'yyyy-MM-dd')
        )
        const buckets = {}
        rangeSessions.forEach((s) => {
          const subj = s.subject || 'Other'
          buckets[subj] = (buckets[subj] || 0) + (Number(s.durationMinutes) || 0) / 60
        })
        return Object.entries(buckets)
          .map(([name, value]) => ({ name, value: +value.toFixed(1) }))
          .sort((a, b) => b.value - a.value)
      }

      if (domain === 'timeflow' && metric === 'categoryBreakdown') {
        const rangeEntries = timeEntries.filter(
          (t) => t.date >= format(startDate, 'yyyy-MM-dd') && t.date <= format(now, 'yyyy-MM-dd')
        )
        const buckets = {}
        rangeEntries.forEach((t) => {
          const cat = t.category || 'Other'
          buckets[cat] = (buckets[cat] || 0) + (Number(t.durationMinutes) || 0) / 60
        })
        return Object.entries(buckets)
          .map(([name, value]) => ({ name, value: +value.toFixed(1) }))
          .sort((a, b) => b.value - a.value)
      }

      return []
    }

    // --- Time-series metrics ---
    function getDayValue(dateKey) {
      if (domain === 'finance') {
        const dayExp = expenses.filter((e) => e.date === dateKey)
        const total = dayExp.reduce((a, e) => a + (Number(e.amount) || 0), 0)
        if (metric === 'totalSpend' || metric === 'avgSpend') return total
      }

      if (domain === 'study') {
        const daySessions = studySessions.filter((s) => s.date === dateKey)
        const totalMin = daySessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
        return +(totalMin / 60).toFixed(2)
      }

      if (domain === 'timeflow') {
        const dayEntries = timeEntries.filter((t) => t.date === dateKey)
        if (metric === 'productiveHours') {
          return +(dayEntries.filter((t) => !t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60).toFixed(2)
        }
        if (metric === 'wasteHours') {
          return +(dayEntries.filter((t) => t.isWaste).reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60).toFixed(2)
        }
      }

      if (domain === 'habits') {
        const dayLogs = habitLogs.filter((l) => l.date === dateKey && l.status === 'done')
        if (metric === 'completionRate') {
          return checkpoints.length > 0 ? +((dayLogs.length / checkpoints.length) * 100).toFixed(1) : 0
        }
        if (metric === 'streakLength') {
          return dayLogs.length
        }
      }

      if (domain === 'health') {
        const dayBody = bodyLogs.filter((h) => h.date === dateKey)
        if (metric === 'steps') return dayBody.reduce((a, h) => a + (Number(h.steps) || 0), 0)
        if (metric === 'sleep') {
          const sleepEntries = dayBody.filter((h) => h.sleepHours)
          return sleepEntries.length > 0
            ? +(sleepEntries.reduce((a, h) => a + (Number(h.sleepHours) || 0), 0) / sleepEntries.length).toFixed(1)
            : 0
        }
        if (metric === 'weight') {
          const weightEntries = dayBody.filter((h) => h.weight)
          return weightEntries.length > 0 ? Number(weightEntries[weightEntries.length - 1].weight) || 0 : 0
        }
      }

      if (domain === 'journal') {
        const dayEntries = journalEntries.filter((j) => j.date === dateKey)
        if (metric === 'mood') {
          return dayEntries.length > 0
            ? +(dayEntries.reduce((a, j) => a + (Number(j.mood) || 0), 0) / dayEntries.length).toFixed(1)
            : 0
        }
        if (metric === 'entryCount') return dayEntries.length
      }

      return 0
    }

    // Build daily data
    const dailyValues = days.map((d) => ({
      date: d.date,
      dateObj: d.dateObj,
      value: getDayValue(d.date),
    }))

    // Group by day / week / month
    if (groupBy === 'day') {
      return dailyValues.map((d) => ({
        label: range <= 7 ? format(d.dateObj, 'EEE') : range <= 90 ? format(d.dateObj, 'MMM d') : format(d.dateObj, 'MMM d'),
        value: d.value,
      }))
    }

    if (groupBy === 'week') {
      const buckets = {}
      const bucketOrder = []
      dailyValues.forEach((d) => {
        const weekStart = format(startOfWeek(d.dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        if (!buckets[weekStart]) {
          buckets[weekStart] = { values: [], dateObj: startOfWeek(d.dateObj, { weekStartsOn: 1 }) }
          bucketOrder.push(weekStart)
        }
        buckets[weekStart].values.push(d.value)
      })
      return bucketOrder.map((key) => {
        const b = buckets[key]
        const sum = b.values.reduce((a, v) => a + v, 0)
        const avg = b.values.length > 0 ? sum / b.values.length : 0
        const isAvgMetric = metric === 'avgSpend' || metric === 'avgHours' || metric === 'completionRate' || metric === 'sleep' || metric === 'mood' || metric === 'weight'
        return {
          label: format(b.dateObj, 'MMM d'),
          value: +(isAvgMetric ? avg : sum).toFixed(2),
        }
      })
    }

    if (groupBy === 'month') {
      const buckets = {}
      const bucketOrder = []
      dailyValues.forEach((d) => {
        const monthStart = format(startOfMonth(d.dateObj), 'yyyy-MM')
        if (!buckets[monthStart]) {
          buckets[monthStart] = { values: [], dateObj: startOfMonth(d.dateObj) }
          bucketOrder.push(monthStart)
        }
        buckets[monthStart].values.push(d.value)
      })
      return bucketOrder.map((key) => {
        const b = buckets[key]
        const sum = b.values.reduce((a, v) => a + v, 0)
        const avg = b.values.length > 0 ? sum / b.values.length : 0
        const isAvgMetric = metric === 'avgSpend' || metric === 'avgHours' || metric === 'completionRate' || metric === 'sleep' || metric === 'mood' || metric === 'weight'
        return {
          label: format(b.dateObj, 'MMM yyyy'),
          value: +(isAvgMetric ? avg : sum).toFixed(2),
        }
      })
    }

    return dailyValues.map((d) => ({
      label: format(d.dateObj, 'MMM d'),
      value: d.value,
    }))
  }, [domain, metric, range, groupBy, expenses, studySessions, timeEntries, checkpoints, habitLogs, bodyLogs, journalEntries])

  // Summary stats
  const summaryStats = useMemo(() => {
    if (isBreakdownMetric(metric)) {
      const total = chartData.reduce((a, d) => a + d.value, 0)
      const max = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 0
      const min = chartData.length > 0 ? Math.min(...chartData.map((d) => d.value)) : 0
      const topCategory = chartData.length > 0 ? chartData[0].name : '—'
      return { total: +total.toFixed(2), max: +max.toFixed(2), min: +min.toFixed(2), average: chartData.length > 0 ? +(total / chartData.length).toFixed(2) : 0, topCategory }
    }

    const values = chartData.map((d) => d.value)
    if (values.length === 0) return { total: 0, max: 0, min: 0, average: 0 }
    const total = values.reduce((a, v) => a + v, 0)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const average = +(total / values.length).toFixed(2)
    return { total: +total.toFixed(2), max: +max.toFixed(2), min: +min.toFixed(2), average }
  }, [chartData, metric])

  const domainColor = getDomainColor(domain)

  const tooltipStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
  }

  const selectStyle = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'DM Sans, sans-serif',
    fontWeight: '600',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '140px',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '32px',
  }

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '5px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  function renderChart() {
    if (!chartData || chartData.length === 0) {
      return (
        <div style={{
          height: '320px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}>
          No data for this selection.
        </div>
      )
    }

    const effectiveChart = isBreakdownMetric(metric) ? 'Pie' : chartType

    if (effectiveChart === 'Line') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={domainColor}
              strokeWidth={2.5}
              dot={{ fill: domainColor, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (effectiveChart === 'Bar') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill={domainColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (effectiveChart === 'Pie') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={120}
              innerRadius={50}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
            >
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    return null
  }

  const currentMetrics = METRICS_BY_DOMAIN[domain] || []
  const currentMetricLabel = currentMetrics.find((m) => m.value === metric)?.label || metric
  const currentRangeLabel = TIME_RANGES.find((r) => r.value === range)?.label || ''

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: '800',
          fontSize: '1.4rem',
          margin: 0,
        }}>
          🔬 Analysis Builder
        </h1>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginTop: '4px',
        }}>
          Build your own charts. Pick a domain, metric, range, and visualization.
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Config Row */}
        <Card>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            alignItems: 'end',
          }}>
            {/* Domain */}
            <div>
              <span style={labelStyle}>Domain</span>
              <select
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                style={selectStyle}
              >
                {DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Metric */}
            <div>
              <span style={labelStyle}>Metric</span>
              <select
                value={metric}
                onChange={(e) => handleMetricChange(e.target.value)}
                style={selectStyle}
              >
                {currentMetrics.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Time Range */}
            <div>
              <span style={labelStyle}>Time Range</span>
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                style={selectStyle}
              >
                {TIME_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Chart Type */}
            <div>
              <span style={labelStyle}>Chart Type</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {CHART_TYPES.map((type) => {
                  const isActive = (isBreakdownMetric(metric) ? 'Pie' : chartType) === type
                  const isDisabled = isBreakdownMetric(metric) && type !== 'Pie'
                  return (
                    <button
                      key={type}
                      onClick={() => !isDisabled && setChartType(type)}
                      disabled={isDisabled}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${isActive ? domainColor : 'var(--border)'}`,
                        background: isActive ? `${domainColor}18` : 'var(--bg-secondary)',
                        color: isActive ? domainColor : 'var(--text-secondary)',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        fontWeight: isActive ? '700' : '500',
                        fontSize: '12px',
                        fontFamily: 'DM Sans, sans-serif',
                        transition: 'all 0.15s ease',
                        opacity: isDisabled ? 0.4 : 1,
                      }}
                    >
                      {type === 'Line' ? '📈' : type === 'Bar' ? '📊' : '🥧'} {type}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Group By */}
            {showGroupBy && (
              <div>
                <span style={labelStyle}>Group By</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {GROUP_BY_OPTIONS.map((opt) => {
                    const isActive = groupBy === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setGroupBy(opt.value)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${isActive ? domainColor : 'var(--border)'}`,
                          background: isActive ? `${domainColor}18` : 'var(--bg-secondary)',
                          color: isActive ? domainColor : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: isActive ? '700' : '500',
                          fontSize: '12px',
                          fontFamily: 'DM Sans, sans-serif',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Chart Title */}
        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: domainColor,
              flexShrink: 0,
            }} />
            <h3 style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: '700',
              fontSize: '15px',
              margin: 0,
              color: 'var(--text-primary)',
            }}>
              {currentMetricLabel}
            </h3>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontWeight: '500',
              marginLeft: 'auto',
            }}>
              {currentRangeLabel}{showGroupBy ? ` · by ${groupBy}` : ''}
            </span>
          </div>
          {renderChart()}
        </Card>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Total', value: summaryStats.total, icon: '∑' },
            { label: 'Average', value: summaryStats.average, icon: 'μ' },
            { label: 'Min', value: summaryStats.min, icon: '↓' },
            { label: 'Max', value: summaryStats.max, icon: '↑' },
          ].map((stat) => (
            <Card key={stat.label}>
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{
                  fontSize: '18px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: `${domainColor}15`,
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 8px',
                  fontWeight: '800',
                  color: domainColor,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {stat.icon}
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '800',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: domainColor,
                }}>
                  {stat.value.toLocaleString()}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                  fontWeight: '600',
                }}>
                  {stat.label}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Breakdown top category callout */}
        {isBreakdownMetric(metric) && summaryStats.topCategory && summaryStats.topCategory !== '—' && (
          <Card>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '4px 0',
            }}>
              <div style={{
                fontSize: '22px',
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: `${domainColor}15`,
                display: 'grid',
                placeItems: 'center',
              }}>
                🏆
              </div>
              <div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                }}>
                  Top Category: <span style={{ color: domainColor }}>{summaryStats.topCategory}</span>
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                }}>
                  Highest value across {chartData.length} categories in the selected range.
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
