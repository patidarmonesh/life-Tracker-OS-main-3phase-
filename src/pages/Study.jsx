import { useState } from 'react'
import { BookOpen, Timer } from 'lucide-react'
import { Page, Card, StatCard, Button, HeatCalendar, DateNavigator } from '../ui/index'
import { useAppState } from '../context/appHooks'
import { getTodayDateKey } from '../utils/dateTime'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'

export default function Study() {
  const state = useAppState()
  const today = getTodayDateKey(state.settings?.profile?.timezone)
  const [date, setDate] = useState(today)

  const sessions = state.study?.sessions || []
  const todaySessions = sessions.filter(s => s.date === date)
  const focusMinutes = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0)

  const getDayFocus = (d) => {
    const daySessions = sessions.filter(s => s.date === d)
    const mins = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0)
    if (mins === 0) return { value: 0, cellBg: 'transparent' }
    const ratio = Math.min(mins / 240, 1) // 4 hours is max intensity
    return { value: `${Math.round(mins/60)}h`, cellBg: `rgba(59, 130, 246, ${ratio})` }
  }

  return <Page title="Study" icon={BookOpen} color="#3B82F6"
    actions={<DateNavigator value={date} onChange={setDate} today={today} />}>
    
    <div className="ui-grid cols-2">
      <StatCard label="Study Sessions" value={todaySessions.length} />
      <StatCard label="Focus Minutes" value={focusMinutes} />
    </div>

    <Card title="Study Intensity Heatmap">
      <HeatCalendar month={date.slice(0, 7)} getDay={getDayFocus} />
    </Card>

    <Card title="Start Session">
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="primary" icon={Timer} onClick={() => alert("Focus Timer not implemented")}>Start Focus Timer</Button>
      </div>
    </Card>

  
    <Card title="Study History">
      <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[{day:'Mon', hours:2}, {day:'Tue', hours:3}, {day:'Wed', hours:1}, {day:'Thu', hours:4}, {day:'Fri', hours:2}, {day:'Sat', hours:0}, {day:'Sun', hours:5}]} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0' }} />
            <Bar dataKey="hours" fill="var(--accent-indigo)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  
  </Page>
}
