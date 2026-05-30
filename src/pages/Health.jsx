import { useMemo, useState, useRef } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { format, subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import { Plus, Upload, Trash2 } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'

const METRIC_CONFIG = {
  weight:      { label: 'Weight',       unit: 'kg',   color: '#3B82F6', icon: '⚖️',  goal: 72 },
  bodyFat:     { label: 'Body Fat',     unit: '%',    color: '#F97316', icon: '📊',  goal: 12 },
  muscleMass:  { label: 'Muscle Mass',  unit: 'kg',   color: '#10B981', icon: '💪',  goal: 60 },
  waist:       { label: 'Waist',        unit: 'cm',   color: '#EC4899', icon: '📏',  goal: 78 },
  chest:       { label: 'Chest',        unit: 'cm',   color: '#8B5CF6', icon: '📏',  goal: 100 },
  bicep:       { label: 'Bicep',        unit: 'cm',   color: '#F59E0B', icon: '💪',  goal: 38 },
}

const MACRO_COLORS = {
  calories: '#F97316', protein: '#10B981', carbs: '#3B82F6', fat: '#F59E0B', fiber: '#8B5CF6'
}

export default function Health() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)
  const [activeTab, setActiveTab] = useState('body')
  const [showLogModal, setShowLogModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importType, setImportType] = useState(null)
  const [importStatus, setImportStatus] = useState(null)
  const [logForm, setLogForm] = useState({
    date: today, weight: '', bodyFat: '', muscleMass: '',
    waist: '', chest: '', bicep: '', notes: ''
  })
  const cronometerRef = useRef(null)
  const hevyRef = useRef(null)
  const appleRef = useRef(null)

  const bodyLogs  = state.health?.bodyLogs  || []
  const nutrition = state.health?.nutrition  || []
  const hevyWorkouts = state.health?.hevyWorkouts || []

  // ── Body metrics chart data (last 30 days) ─────────────────
  const metricHistoryByMetric = useMemo(() => {
    const sortedBodyLogs = [...bodyLogs].sort((a, b) => a.date.localeCompare(b.date))
    return Object.fromEntries(
      Object.keys(METRIC_CONFIG).map(metric => [
        metric,
        sortedBodyLogs
          .filter(l => l[metric] != null)
          .slice(-30)
          .map(l => ({ date: format(new Date(l.date + 'T00:00:00'), 'MMM d'), value: l[metric] })),
      ])
    )
  }, [bodyLogs])

  function getMetricHistory(metric) {
    return metricHistoryByMetric[metric] || []
  }

  const latestLog = useMemo(
    () => bodyLogs.length ? [...bodyLogs].sort((a, b) => b.date.localeCompare(a.date))[0] : null,
    [bodyLogs]
  )

  // ── Nutrition chart data (last 14 days) ─────────────────────
  const last14Nutrition = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = toDateKey(subDays(new Date(), 13 - i), timezone)
    const entry = nutrition.find(n => n.date === d)
    return {
      day: formatDateKey(d, timezone, { month: 'short', day: 'numeric' }),
      calories: entry?.calories || 0,
      protein:  entry?.protein  || 0,
      carbs:    entry?.carbs    || 0,
      fat:      entry?.fat      || 0,
    }
  }), [nutrition, timezone])

  const avgNutrition = useMemo(() => nutrition.length ? {
    calories: Math.round(nutrition.reduce((a, n) => a + (n.calories || 0), 0) / nutrition.length),
    protein:  Math.round(nutrition.reduce((a, n) => a + (n.protein  || 0), 0) / nutrition.length),
    carbs:    Math.round(nutrition.reduce((a, n) => a + (n.carbs    || 0), 0) / nutrition.length),
    fat:      Math.round(nutrition.reduce((a, n) => a + (n.fat      || 0), 0) / nutrition.length),
  } : null, [nutrition])

  const hevyVolumeData = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')
    const workout = hevyWorkouts.find(w => w.date === d)
    const volume = workout?.exercises?.reduce(
      (a, ex) => a + ex.sets.reduce((s, set) => s + (set.reps * set.weight), 0),
      0
    ) || 0
    return { day: format(new Date(d + 'T00:00:00'), 'MMM d'), volume: Math.round(volume) }
  }), [hevyWorkouts])

  // ── Save body log ──────────────────────────────────────────
  function saveBodyLog() {
    const hasData = Object.keys(METRIC_CONFIG).some(k => logForm[k] !== '')
    if (!hasData) return alert('Enter at least one measurement')
    const entry = {
      id: uuid(), date: logForm.date, notes: logForm.notes,
      ...Object.fromEntries(
        Object.keys(METRIC_CONFIG)
          .filter(k => logForm[k] !== '')
          .map(k => [k, parseFloat(logForm[k])])
      ),
      createdAt: new Date().toISOString()
    }
    const filtered = bodyLogs.filter(l => l.date !== logForm.date)
    setModule('health', { ...state.health, bodyLogs: [entry, ...filtered] })
    setShowLogModal(false)
    setLogForm({ date: today, weight: '', bodyFat: '', muscleMass: '', waist: '', chest: '', bicep: '', notes: '' })
  }

  // ── Cronometer CSV import ──────────────────────────────────
  function handleCronometerImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportStatus('reading')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split('\n').filter(Boolean)
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
        const parsed = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
          const row = {}
          headers.forEach((h, idx) => { row[h] = cols[idx] })
          // Cronometer header names
          const dateRaw = row['day'] || row['date'] || ''
          if (!dateRaw) continue
          let dateStr = dateRaw
          // Handle MM/DD/YYYY or YYYY-MM-DD
          if (dateRaw.includes('/')) {
            const [m, d, y] = dateRaw.split('/')
            dateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
          }
          const entry = {
            id: uuid(), date: dateStr, source: 'cronometer',
            calories: parseFloat(row['energy (kcal)'] || row['calories'] || 0) || 0,
            protein:  parseFloat(row['protein (g)']   || row['protein']  || 0) || 0,
            carbs:    parseFloat(row['carbohydrates (g)'] || row['carbs'] || 0) || 0,
            fat:      parseFloat(row['fat (g)']        || row['fat']     || 0) || 0,
            fiber:    parseFloat(row['fiber (g)']      || row['fiber']   || 0) || 0,
          }
          if (entry.calories > 0 || entry.protein > 0) parsed.push(entry)
        }
        // Merge with existing, dedupe by date
        const existing = (state.health?.nutrition || []).filter(n => n.source !== 'cronometer')
        setModule('health', { ...state.health, nutrition: [...existing, ...parsed] })
        setImportStatus(`success:${parsed.length}`)
      } catch (err) {
        setImportStatus('error')
      }
    }
    reader.readAsText(file)
  }

  // ── Hevy CSV import ────────────────────────────────────────
  function handleHevyImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportStatus('reading')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split('\n').filter(Boolean)
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
        const workoutMap = {}
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
          const row = {}
          headers.forEach((h, idx) => { row[h] = cols[idx] })
          const dateRaw = row['start_time'] || row['date'] || ''
          const dateStr = dateRaw ? dateRaw.split(' ')[0].split('T')[0] : ''
          if (!dateStr) continue
          const workoutTitle = row['workout_name'] || row['title'] || 'Workout'
          const key = dateStr + '_' + workoutTitle
          if (!workoutMap[key]) {
            workoutMap[key] = {
              id: uuid(), date: dateStr, title: workoutTitle,
              source: 'hevy', exercises: [], createdAt: new Date().toISOString()
            }
          }
          const exName = row['exercise_name'] || row['exercise_title'] || ''
          if (exName) {
            let ex = workoutMap[key].exercises.find(e => e.name === exName)
            if (!ex) { ex = { name: exName, sets: [] }; workoutMap[key].exercises.push(ex) }
            ex.sets.push({
              reps:   parseInt(row['reps']   || 0),
              weight: parseFloat(row['weight_kg'] || row['weight'] || 0),
            })
          }
        }
        const parsed = Object.values(workoutMap)
        const existing = (state.health?.hevyWorkouts || []).filter(w => w.source !== 'hevy')
        setModule('health', { ...state.health, hevyWorkouts: [...existing, ...parsed] })
        setImportStatus(`success:${parsed.length}`)
      } catch {
        setImportStatus('error')
      }
    }
    reader.readAsText(file)
  }

  // ── Apple Health XML import ────────────────────────────────
  function handleAppleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportStatus('reading')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target.result
        const stepMatches = [...text.matchAll(/type="HKQuantityTypeIdentifierStepCount"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g)]
        const weightMatches = [...text.matchAll(/type="HKQuantityTypeIdentifierBodyMass"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g)]
        const hrMatches = [...text.matchAll(/type="HKQuantityTypeIdentifierHeartRate"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g)]

        // Steps by day
        const stepsByDay = {}
        stepMatches.forEach(([, dateRaw, val]) => {
          const d = dateRaw.split(' ')[0]
          stepsByDay[d] = (stepsByDay[d] || 0) + parseInt(val)
        })

        // Weight by day (latest reading)
        const weightByDay = {}
        weightMatches.forEach(([, dateRaw, val]) => {
          const d = dateRaw.split(' ')[0]
          weightByDay[d] = parseFloat(val)
        })

        // Resting HR by day (average)
        const hrByDay = {}
        hrMatches.forEach(([, dateRaw, val]) => {
          const d = dateRaw.split(' ')[0]
          if (!hrByDay[d]) hrByDay[d] = []
          hrByDay[d].push(parseFloat(val))
        })

        // Merge into bodyLogs
        const allDates = new Set([...Object.keys(weightByDay), ...Object.keys(stepsByDay)])
        const newBodyLogs = []
        allDates.forEach(date => {
          newBodyLogs.push({
            id: uuid(), date, source: 'apple_health',
            weight: weightByDay[date] || null,
            steps: stepsByDay[date] || null,
            restingHR: hrByDay[date] ? Math.round(hrByDay[date].reduce((a,b) => a+b) / hrByDay[date].length) : null,
          })
        })

        const existing = (state.health?.bodyLogs || []).filter(l => l.source !== 'apple_health')
        setModule('health', { ...state.health, bodyLogs: [...existing, ...newBodyLogs] })
        setImportStatus(`success:${newBodyLogs.length}`)
      } catch {
        setImportStatus('error')
      }
    }
    reader.readAsText(file)
  }

  // ── Styles ─────────────────────────────────────────────────
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
    padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? '#10B981' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid #10B981' : '2px solid transparent',
  })

  const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>🏥 Health</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => { setShowImportModal(true); setImportStatus(null) }}>
            <Upload size={15} /> Import Data
          </Button>
          <Button onClick={() => setShowLogModal(true)}>
            <Plus size={16} /> Log Metrics
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {['body', 'nutrition', 'workouts', 'overview'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab === 'body' ? '⚖️ Body' : tab === 'nutrition' ? '🥗 Nutrition' : tab === 'workouts' ? '🏋️ Hevy' : '📊 Overview'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ══ BODY METRICS TAB ═══════════════════════════════ */}
        {activeTab === 'body' && <>

          {/* Latest readings */}
          {latestLog && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
                latestLog[key] != null && (
                  <Card key={key} style={{ padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{cfg.icon}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: cfg.color }}>
                      {latestLog[key]}{cfg.unit}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{cfg.label}</div>
                    {cfg.goal && (
                      <div style={{ fontSize: '11px', color: latestLog[key] <= cfg.goal ? '#10B981' : '#F59E0B', marginTop: '2px' }}>
                        goal: {cfg.goal}{cfg.unit}
                      </div>
                    )}
                  </Card>
                )
              ))}
            </div>
          )}

          {/* Weight chart */}
          {getMetricHistory('weight').length > 1 && (
            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Weight Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={getMetricHistory('weight')} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} kg`, 'Weight']} />
                  <ReferenceLine y={METRIC_CONFIG.weight.goal} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'Goal', fill: '#10B981', fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: '#3B82F6', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Body fat chart */}
          {getMetricHistory('bodyFat').length > 1 && (
            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Body Fat %</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={getMetricHistory('bodyFat')} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Body Fat']} />
                  <ReferenceLine y={METRIC_CONFIG.bodyFat.goal} stroke="#10B981" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="value" stroke="#F97316" strokeWidth={2.5} dot={{ fill: '#F97316', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Steps from Apple Health */}
          {bodyLogs.some(l => l.steps) && (
            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Daily Steps (Apple Health)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={Array.from({ length: 14 }, (_, i) => {
                    const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')
                    const log = bodyLogs.find(l => l.date === d)
                    return { day: format(new Date(d + 'T00:00:00'), 'MMM d'), steps: log?.steps || 0 }
                  })}
                  margin={{ top: 0, right: 0, bottom: 0, left: -10 }}
                >
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [v.toLocaleString(), 'Steps']} />
                  <ReferenceLine y={10000} stroke="#10B981" strokeDasharray="4 4" label={{ value: '10k goal', fill: '#10B981', fontSize: 10 }} />
                  <Bar dataKey="steps" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Measurements table */}
          {bodyLogs.length > 0 && (
            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>Log History</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Weight', 'Body Fat', 'Muscle', 'Waist', 'Source'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...bodyLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{l.date}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#3B82F6' }}>{l.weight ? `${l.weight}kg` : '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{l.bodyFat ? `${l.bodyFat}%` : '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{l.muscleMass ? `${l.muscleMass}kg` : '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{l.waist ? `${l.waist}cm` : '—'}</td>
                        <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>{l.source || 'manual'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {bodyLogs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚖️</div>
              <div style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '15px' }}>No body metrics yet</div>
              <div style={{ fontSize: '13px', marginTop: '4px', marginBottom: '16px' }}>Log manually or import from Apple Health</div>
              <Button onClick={() => setShowLogModal(true)}><Plus size={14} /> Log Now</Button>
            </div>
          )}
        </>}

        {/* ══ NUTRITION TAB ══════════════════════════════════ */}
        {activeTab === 'nutrition' && <>

          {/* Avg macros */}
          {avgNutrition && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { key: 'calories', label: 'Avg Calories', unit: 'kcal', goal: 2200 },
                { key: 'protein',  label: 'Avg Protein',  unit: 'g',    goal: 160 },
                { key: 'carbs',    label: 'Avg Carbs',    unit: 'g',    goal: 250 },
                { key: 'fat',      label: 'Avg Fat',      unit: 'g',    goal: 70  },
              ].map(({ key, label, unit, goal }) => (
                <Card key={key} style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: MACRO_COLORS[key] }}>{avgNutrition[key]}{unit}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                  <div style={{ fontSize: '10px', color: avgNutrition[key] >= goal * 0.9 && avgNutrition[key] <= goal * 1.1 ? '#10B981' : '#F59E0B', marginTop: '1px' }}>goal {goal}{unit}</div>
                </Card>
              ))}
            </div>
          )}

          {/* Calories chart */}
          {last14Nutrition.some(d => d.calories > 0) ? (
            <>
              <Card>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Calories (last 14 days)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={last14Nutrition} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} kcal`, 'Calories']} />
                    <ReferenceLine y={2200} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'Goal', fill: '#10B981', fontSize: 10 }} />
                    <Bar dataKey="calories" fill="#F97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Protein chart */}
              <Card>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Protein Intake (last 14 days)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={last14Nutrition} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}g`, 'Protein']} />
                    <ReferenceLine y={160} stroke="#10B981" strokeDasharray="4 4" label={{ value: '160g goal', fill: '#10B981', fontSize: 10 }} />
                    <Line type="monotone" dataKey="protein" stroke="#10B981" strokeWidth={2.5} dot={{ fill: '#10B981', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Macros stacked bar */}
              <Card>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Macro Breakdown</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={last14Nutrition} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v}g`, name]} />
                    <Bar dataKey="protein" stackId="a" fill="#10B981" radius={[0,0,0,0]} />
                    <Bar dataKey="carbs"   stackId="a" fill="#3B82F6" />
                    <Bar dataKey="fat"     stackId="a" fill="#F59E0B" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
                  {[['Protein','#10B981'],['Carbs','#3B82F6'],['Fat','#F59E0B']].map(([name, color]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color }} />{name}
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🥗</div>
              <div style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '15px' }}>No nutrition data yet</div>
              <div style={{ fontSize: '13px', marginTop: '4px', marginBottom: '16px' }}>Import your Cronometer CSV export to see charts here</div>
              <Button variant="secondary" onClick={() => { setShowImportModal(true); setImportStatus(null) }}>
                <Upload size={14} /> Import Cronometer
              </Button>
            </div>
          )}
        </>}

        {/* ══ HEVY WORKOUTS TAB ══════════════════════════════ */}
        {activeTab === 'workouts' && <>
          {hevyWorkouts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏋️</div>
              <div style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '15px' }}>No Hevy workouts imported</div>
              <div style={{ fontSize: '13px', marginTop: '4px', marginBottom: '16px' }}>Export CSV from Hevy app → Profile → Export Data</div>
              <Button variant="secondary" onClick={() => { setShowImportModal(true); setImportStatus(null) }}>
                <Upload size={14} /> Import Hevy
              </Button>
            </div>
          ) : (
            <>
              {/* Volume chart */}
              <Card>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Workout Volume (last 14 days)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={hevyVolumeData}
                    margin={{ top: 0, right: 0, bottom: 0, left: -10 }}
                  >
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}kg`, 'Volume']} />
                    <Bar dataKey="volume" fill="#EC4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...hevyWorkouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(w => (
                  <Card key={w.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>{w.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.date} • {w.exercises?.length} exercises</div>
                      </div>
                      <div style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: '#EC4899', fontWeight: '700' }}>
                        {Math.round(w.exercises?.reduce((a, ex) => a + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0) || 0)}kg vol
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {w.exercises?.slice(0, 5).map((ex, i) => (
                        <span key={i} style={{ padding: '3px 10px', background: 'var(--bg-secondary)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {ex.name} ({ex.sets.length}×)
                        </span>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>}

        {/* ══ OVERVIEW TAB ═══════════════════════════════════ */}
        {activeTab === 'overview' && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[
              { label: 'Body Logs', value: bodyLogs.length, icon: '⚖️', color: '#3B82F6' },
              { label: 'Nutrition Days', value: nutrition.length, icon: '🥗', color: '#F97316' },
              { label: 'Hevy Workouts', value: hevyWorkouts.length, icon: '🏋️', color: '#EC4899' },
              { label: 'Latest Weight', value: latestLog?.weight ? `${latestLog.weight}kg` : '—', icon: '📊', color: '#10B981' },
            ].map(({ label, value, icon, color }) => (
              <Card key={label} style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{icon}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
              </Card>
            ))}
          </div>

          {/* Data sources status */}
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Data Sources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { name: 'Cronometer', icon: '🥗', desc: 'Nutrition & macro tracking', connected: nutrition.some(n => n.source === 'cronometer'), count: nutrition.filter(n => n.source === 'cronometer').length + ' days' },
                { name: 'Hevy', icon: '🏋️', desc: 'Gym workout history', connected: hevyWorkouts.length > 0, count: hevyWorkouts.length + ' workouts' },
                { name: 'Apple Health', icon: '🍎', desc: 'Steps, weight, heart rate', connected: bodyLogs.some(l => l.source === 'apple_health'), count: bodyLogs.filter(l => l.source === 'apple_health').length + ' days' },
                { name: 'Manual Logs', icon: '✍️', desc: 'Body measurements you entered', connected: bodyLogs.some(l => !l.source || l.source === 'manual'), count: bodyLogs.filter(l => !l.source || l.source === 'manual').length + ' entries' },
              ].map(({ name, icon, desc, connected, count }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'var(--border)'}` }}>
                  <div style={{ fontSize: '24px' }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: connected ? '#10B981' : 'var(--text-muted)' }}>
                      {connected ? '✅ Connected' : '— Not imported'}
                    </div>
                    {connected && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{count}</div>}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowImportModal(true); setImportStatus(null) }}
              style={{ width: '100%', marginTop: '12px', padding: '10px', borderRadius: '10px', border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', color: 'var(--accent-indigo)', fontWeight: '600', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>
              + Import More Data
            </button>
          </Card>
        </>}

      </div>

      {/* ══ LOG METRICS MODAL ══════════════════════════════════ */}
      <Modal isOpen={showLogModal} onClose={() => setShowLogModal(false)} title="Log Body Metrics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input style={inputStyle} type="date" value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
              <div key={key}>
                <label style={labelStyle}>{cfg.icon} {cfg.label} ({cfg.unit})</label>
                <input style={inputStyle} type="number" inputMode="numeric" step="0.1" placeholder={`e.g. ${cfg.goal}`}
                  value={logForm[key]} onChange={e => setLogForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <input style={inputStyle} placeholder="Any notes (post-workout, morning fasted...)" value={logForm.notes}
              onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button onClick={saveBodyLog}>Save Metrics</Button>
        </div>
      </Modal>

      {/* ══ IMPORT MODAL ═══════════════════════════════════════ */}
      <Modal isOpen={showImportModal} onClose={() => { setShowImportModal(false); setImportStatus(null) }} title="Import Health Data">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Cronometer */}
          <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>🥗 Cronometer</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Nutrition diary export (.csv)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Cronometer → Profile → Export Data → Nutrition Summary</div>
              </div>
              <button onClick={() => cronometerRef.current?.click()}
                style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#F97316', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
                Upload CSV
              </button>
              <input ref={cronometerRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCronometerImport} />
            </div>
          </div>

          {/* Hevy */}
          <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>🏋️ Hevy</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Workout history export (.csv)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Hevy → Profile → Settings → Export Workout Data</div>
              </div>
              <button onClick={() => hevyRef.current?.click()}
                style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.4)', color: '#EC4899', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
                Upload CSV
              </button>
              <input ref={hevyRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleHevyImport} />
            </div>
          </div>

          {/* Apple Health */}
          <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>🍎 Apple Health</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Steps, weight, heart rate (.xml)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Health app → Profile picture → Export All Health Data</div>
              </div>
              <button onClick={() => appleRef.current?.click()}
                style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
                Upload XML
              </button>
              <input ref={appleRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleAppleImport} />
            </div>
          </div>

          {/* Import status */}
          {importStatus === 'reading' && (
            <div style={{ padding: '12px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', fontSize: '13px', color: 'var(--accent-indigo)', textAlign: 'center' }}>
              ⏳ Processing file...
            </div>
          )}
          {importStatus?.startsWith('success') && (
            <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', fontSize: '13px', color: '#10B981', textAlign: 'center' }}>
              ✅ Imported {importStatus.split(':')[1]} records successfully!
            </div>
          )}
          {importStatus === 'error' && (
            <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px', fontSize: '13px', color: '#F43F5E', textAlign: 'center' }}>
              ❌ Import failed. Check the file format and try again.
            </div>
          )}
        </div>
      </Modal>

    </div>
  )
}
