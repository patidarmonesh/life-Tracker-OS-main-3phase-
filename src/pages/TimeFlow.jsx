import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Clock, Plus, Zap, Coffee, Moon, Sunrise, Sun as SunIcon, Sunset } from 'lucide-react'
import { Page, Card, StatCard, Tabs, Button, Chips, EmptyState, Sheet, Ring, Legend } from '../ui/index'
import HeatCalendar from '../ui/calendar/HeatCalendar'
import DateNavigator from '../ui/calendar/DateNavigator'
import { heatColor } from '../ui/calendar/calendarMath'
import { useLocalPref, useLiveNow } from '../ui/hooks'
import { fmtMinutes, fmtHours, fmtClock, fmtDate } from '../ui/format'
import { localDate, dayBounds, addDays } from '../domain/metrics/dates'
import { adaptActivities, resolveSegments, ALLOCATION_BUCKETS } from '../domain/metrics/records'
import { useAppState } from '../context/appHooks'
import { useNavigate } from 'react-router-dom'

const BUCKET_COLORS = { Focus: '#6366F1', Health: '#10B981', Essentials: '#94A3B8', Leisure: '#F59E0B', Drift: '#F43F5E', Sleep: '#818CF8', Other: '#64748B', Conflict: '#EF4444' }
const THEME = hour => {
  if (hour < 6) return { label: 'Night', icon: Moon, bg: '#111', orb: '#6366F1' }
  if (hour < 12) return { label: 'Morning', icon: Sunrise, bg: '#111', orb: '#F59E0B' }
  if (hour < 17) return { label: 'Afternoon', icon: SunIcon, bg: '#111', orb: '#22D3EE' }
  if (hour < 21) return { label: 'Evening', icon: Sunset, bg: '#111', orb: '#A78BFA' }
  return { label: 'Night', icon: Moon, bg: '#111', orb: '#6366F1' }
}

export default function TimeFlow() {
  const state = useAppState()
  const navigate = useNavigate()
  const now = useLiveNow(30000)
  const today = localDate(now)
  const [date, setDate] = useState(today)
  const [tab, setTab] = useLocalPref('timeflow_tab', 'day')
  const hour = new Date(now).getHours()
  const theme = THEME(hour)

  const { records } = useMemo(() => adaptActivities(state), [state])
  const dayRecords = useMemo(() => records.filter(r => r.date === date), [records, date])
  const bounds = useMemo(() => { try { return dayBounds(date, 'Asia/Kolkata', now) } catch { return null } }, [date, now])
  const segments = useMemo(() => bounds ? resolveSegments(dayRecords, bounds.start, bounds.cutoff) : [], [dayRecords, bounds])

  const bucketMinutes = useMemo(() => {
    const m = {}; ALLOCATION_BUCKETS.forEach(b => { m[b] = 0 })
    segments.forEach(s => { m[s.bucket] = (m[s.bucket] || 0) + s.minutes })
    return m
  }, [segments])
  const totalLogged = Object.values(bucketMinutes).reduce((a, b) => a + b, 0)
  const gapMinutes = bounds ? bounds.elapsedMinutes - totalLogged : 0

  const tabs = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ]

  return <Page title="Time Flow" icon={Clock} color="#22D3EE" className="pb-24 max-md:pb-24"
    actions={<>
      <DateNavigator value={date} onChange={setDate} today={today} max={today} />
      <Button variant="primary" icon={Plus} onClick={() => navigate('/capture?type=time')}>Log</Button>
    </>}>

    {/* Live clock hero */}
    {date === today && <Card glass style={{ background: theme.bg, position: 'relative', overflow: 'hidden', padding: '2rem 1.5rem', borderRadius: '0', boxShadow: 'none' }}>
      <div className="orb" style={{ '--orb': theme.orb, top: '-30%', right: '-10%', width: 300, height: 300, opacity: .35, filter: 'blur(50px)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.15em', fontWeight: 700, color: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <theme.icon size={16} />{theme.label}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.1, color: '#FFFFFF', letterSpacing: '-0.02em', marginTop: '4px', textShadow: 'none' }}>
            {new Date(now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,.6)', marginTop: 8, fontWeight: 500 }}>{fmtDate(today, 'long')}</div>
        </div>
      </div>
    </Card>}

    <Tabs tabs={tabs} value={tab} onChange={setTab} id="tf" />

    {tab === 'day' && <DayView segments={segments} bucketMinutes={bucketMinutes} totalLogged={totalLogged} gapMinutes={gapMinutes} navigate={navigate} />}
    {tab === 'week' && <WeekView records={records} date={date} />}
    {tab === 'month' && <MonthView records={records} date={date} setDate={setDate} today={today} />}
    <div className="pb-24 h-24 min-h-[6rem] mb-12"></div>
    </Page>
}

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis } from 'recharts'

function DayView({ segments, bucketMinutes, totalLogged, gapMinutes, navigate }) {
  const active = ALLOCATION_BUCKETS.filter(b => bucketMinutes[b] > 0)
  
  const pieData = active.map(b => ({ name: b, value: bucketMinutes[b] }))
  if (gapMinutes > 15) pieData.push({ name: 'Unlogged', value: gapMinutes })

  return <>
    {/* Stats strip */}
    <div className="ui-grid cols-4">
      <StatCard label="Logged" value={totalLogged > 0 ? totalLogged : null} format={v => fmtMinutes(v)} color="#22D3EE"
        placeholder={{ label: '+ Log', onClick: () => navigate('/capture?type=time') }} />
      <StatCard label="Focus" value={bucketMinutes.Focus > 0 ? bucketMinutes.Focus : null} format={v => fmtHours(v)} color="#6366F1" />
      <StatCard label="Unlogged" value={gapMinutes > 5 ? gapMinutes : null} format={v => fmtMinutes(v)} color="#64748B" />
      <StatCard label="Drift" value={bucketMinutes.Drift > 0 ? bucketMinutes.Drift : null} format={v => fmtMinutes(v)} color="#F43F5E" />
    </div>

    {/* Distribution Chart */}
    {(totalLogged > 0 || gapMinutes > 60) && (
      <Card title="Time Distribution">
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ height: 160, width: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3} animationDuration={1000}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === 'Unlogged' ? 'rgba(100,116,139,0.3)' : BUCKET_COLORS[entry.name]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(v) => fmtMinutes(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 0, color: '#F8FAFC' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'center' }}>
            {active.map(b => <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '.3rem .7rem', borderRadius: 0,
              background: `color-mix(in srgb, ${BUCKET_COLORS[b]} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${BUCKET_COLORS[b]} 35%, transparent)`,
              fontSize: '.78rem', fontWeight: 650 }}>
              <i style={{ width: 8, height: 8, borderRadius: '0', background: BUCKET_COLORS[b], display: 'inline-block' }} />
              {b} · {fmtMinutes(bucketMinutes[b])}
            </span>)}
            {gapMinutes > 15 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '.3rem .7rem', borderRadius: 0, background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', fontSize: '.78rem', fontWeight: 650, color: '#94A3B8' }}>Unlogged · {fmtMinutes(gapMinutes)}</span>}
          </div>
        </div>
      </Card>
    )}

    {/* Timeline */}
    <Card title="Timeline">
      {segments.length === 0 ? <EmptyState emoji="⏱" title="No entries yet" text="Log your first activity to see the timeline" action={<Button icon={Plus} onClick={() => navigate('/capture?type=time')}>Log time</Button>} />
        : <div className="ui-list">
          {segments.map((seg, i) => {
            const color = BUCKET_COLORS[seg.bucket] || '#64748B'
            return <div key={i} className="ui-row" style={{ borderLeft: `3px solid ${color}` }}>
              <div style={{ width: 44, textAlign: 'center', fontSize: '.72rem', fontWeight: 700, color: 'var(--text-3)' }}>
                {fmtClock(new Date(seg.startAt).toTimeString().slice(0, 5))}
              </div>
              <div className="grow">
                <div className="title">{seg.bucket}{seg.isStudy ? ' · Study' : ''}</div>
                <div className="meta">{fmtClock(new Date(seg.startAt).toTimeString().slice(0, 5))} – {fmtClock(new Date(seg.endAt).toTimeString().slice(0, 5))} · {fmtMinutes(seg.minutes)}</div>
              </div>
              <div className="amt" style={{ color }}>{fmtMinutes(seg.minutes)}</div>
            </div>
          })}
        </div>}
    </Card>
  </>
}

function WeekView({ records, date }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6))
  
  const weeklyData = days.map(d => {
    const dayRecs = records.filter(r => r.date === d)
    const focus = dayRecs.filter(r => r.bucket === 'Focus').reduce((a, r) => a + (r.durationMinutes || 0), 0)
    const total = dayRecs.reduce((a, r) => a + (r.durationMinutes || 0), 0)
    return {
      day: fmtDate(d, 'day').split(' ')[1]?.slice(0, 3) || d.slice(8),
      focus: Number((focus / 60).toFixed(1)),
      other: Number(((total - focus) / 60).toFixed(1)),
      total: Number((total / 60).toFixed(1))
    }
  })

  return (
    <Card title="Productive vs Other (Last 7 Days)">
      <div style={{ height: 220, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: 'var(--text-3)', fontSize: 12}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-3)', fontSize: 12}} />
            <RechartsTooltip formatter={(v, name) => [`${v}h`, name]} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 0, color: '#F8FAFC' }} />
            <Line type="monotone" dataKey="focus" name="Focus" stroke="#6366F1" strokeWidth={3} dot={{ fill: '#6366F1', r: 4 }} activeDot={{ r: 6 }} animationDuration={1500} />
            <Line type="monotone" dataKey="other" name="Other" stroke="#94A3B8" strokeWidth={3} dot={{ fill: '#94A3B8', r: 4 }} activeDot={{ r: 6 }} animationDuration={1500} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function MonthView({ records, date, setDate, today }) {
  const month = date.slice(0, 7)
  const [selectedDate, setSelectedDate] = useState(null)

  const getDay = d => {
    if (d > today) return { status: 'future' }
    const dayRecs = records.filter(r => r.date === d)
    const total = dayRecs.reduce((a, r) => a + (r.durationMinutes || 0), 0)
    if (dayRecs.length === 0) return { status: 'unknown' }
    const focus = dayRecs.filter(r => r.bucket === 'Focus').reduce((a, r) => a + (r.durationMinutes || 0), 0)
    return {
      status: 'value', value: fmtHours(total),
      cellBg: heatColor('#6366F1', Math.min(1, total / 600)),
      dots: focus > 0 ? ['#6366F1'] : [],
    }
  }

  return <>
    <HeatCalendar month={month} onMonthChange={m => setDate(`${m}-01`)} getDay={getDay}
      selected={selectedDate} onSelect={setSelectedDate} today={today} maxMonth={today.slice(0, 7)}
      legend={<Legend items={[['rgba(99,102,241,.2)', 'Low'], ['rgba(99,102,241,.5)', 'Medium'], ['rgba(99,102,241,.85)', 'High'], ['transparent', 'Not logged']]} />} />
  </>
}

