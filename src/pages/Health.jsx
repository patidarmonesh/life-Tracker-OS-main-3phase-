import { useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'
import { Heart, Plus, Activity } from 'lucide-react'
import { Page, Card, StatCard, Button, Tabs, HeatCalendar, DateNavigator } from '../ui/index'
import { useAppState, useAppActions } from '../context/appHooks'
import { getTodayDateKey } from '../utils/dateTime'

export default function Health() {
  const state = useAppState()
  const { updateModule } = useAppActions()
  const today = getTodayDateKey(state.settings?.profile?.timezone)
  const [date, setDate] = useState(today)
  const [tab, setTab] = useState('today')

  const waterLogs = (state.health?.waterLogs || []).filter(w => w.date === date)
  const sleepLogs = (state.health?.sleepLogs || [])
  const todaySleep = sleepLogs.find(s => s.date === date)

  function addWater() {
    updateModule('health', prev => ({
      ...prev,
      waterLogs: [...(prev.waterLogs || []), { id: crypto.randomUUID(), date, amount: 250, time: new Date().toISOString() }]
    }))
  }

  const getDaySleep = (d) => {
    const sleep = sleepLogs.find(s => s.date === d)
    if (!sleep) return { value: 0, cellBg: 'transparent' }
    const hours = sleep.duration / 60
    const ratio = Math.min(hours / 8, 1) // 8 hours is 100%
    return { value: `${hours.toFixed(1)}h`, cellBg: `rgba(236, 72, 153, ${ratio})` }
  }

  return <Page title="Health & Sleep" icon={Heart} color="#EC4899"
    actions={<DateNavigator value={date} onChange={setDate} today={today} />}>
    
    <Tabs tabs={[
      { key: 'today', label: 'Today' },
      { key: 'sleep', label: 'Sleep Tracking' }
    ]} value={tab} onChange={setTab} id="health" />

    {tab === 'today' && <>
      <div className="ui-grid cols-2">
        <StatCard label="Water Intake" value={waterLogs.length * 250} format={v => `${v} ml`} />
        <StatCard label="Sleep Duration" value={todaySleep ? `${(todaySleep.duration/60).toFixed(1)} hrs` : '—'} />
      </div>

      <Card title="Quick Log">
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="primary" icon={Plus} onClick={addWater}>Glass of Water (250ml)</Button>
        </div>
      </Card>
    </>}

    {tab === 'sleep' && <>
      <Card title="Sleep Heatmap">
        <HeatCalendar month={date.slice(0, 7)} getDay={getDaySleep} />
      </Card>
    </>}
  
    <Card title="Weight Tracking">
      <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[{day:'W1', weight:75}, {day:'W2', weight:74.5}, {day:'W3', weight:74.2}, {day:'W4', weight:73.8}]} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
            <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0' }} />
            <Area type="monotone" dataKey="weight" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  
  </Page>
}
