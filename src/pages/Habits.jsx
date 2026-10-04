import { useState } from 'react'
import { CheckSquare, Plus, Check } from 'lucide-react'
import { Page, Card, StatCard, Button, HeatCalendar, DateNavigator } from '../ui/index'
import { useAppActions, useAppState } from '../context/appHooks'
import { getTodayDateKey } from '../utils/dateTime'

export default function Habits() {
  const state = useAppState()
  const { updateModule } = useAppActions()
  const today = getTodayDateKey(state.settings?.profile?.timezone)
  const [date, setDate] = useState(today)
  const [viewMonth] = useState(today.slice(0, 7))

  const routines = (state.habits?.checkpoints || []).filter(r => r.isActive !== false)
  const logs = state.habits?.dailyLogs || []

  const doneToday = id => logs.some(l => l.checkpointId === id && l.date === date && l.status === 'done')

  function toggle(id) {
    if (date > today) return
    updateModule('habits', prev => {
      const isDone = doneToday(id)
      const filtered = (prev.dailyLogs || []).filter(l => !(l.checkpointId === id && l.date === date))
      if (!isDone) {
        filtered.push({ id: crypto.randomUUID(), checkpointId: id, date, status: 'done', loggedAt: new Date().toISOString() })
      }
      return { ...prev, dailyLogs: filtered }
    })
  }

  const getDayCompletion = (d) => {
    if (routines.length === 0) return { value: 0, cellBg: 'transparent' }
    const completed = routines.filter(r => logs.some(l => l.checkpointId === r.id && l.date === d && l.status === 'done')).length
    const ratio = completed / routines.length
    if (ratio === 0) return { value: 0, cellBg: 'transparent' }
    return { value: ratio, cellBg: `rgba(99, 102, 241, ${ratio})`, status: d > today ? 'future' : '' }
  }

  return <Page title="Routines" icon={CheckSquare} color="#6366F1"
    actions={<>
      <DateNavigator value={date} onChange={setDate} today={today} />
      <Button variant="primary" icon={Plus} onClick={() => alert("Add habit not implemented")}>Add</Button>
    </>}>
    
    <div className="ui-grid cols-2">
      <StatCard label="Active routines" value={routines.length} />
      <StatCard label="Completed today" value={routines.filter(r => doneToday(r.id)).length} />
    </div>

    <Card title="Today's Routines">
      {routines.length === 0 ? <p style={{ color: 'var(--text-3)' }}>No active routines.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {routines.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--card-hover)', borderRadius: 'var(--radius-m)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24 }}>{r.icon || '🎯'}</div>
                <div style={{ fontWeight: 600 }}>{r.name || r.title}</div>
              </div>
              <Button variant={doneToday(r.id) ? 'primary' : 'secondary'} icon={Check} onClick={() => toggle(r.id)} disabled={date > today}>
                {doneToday(r.id) ? 'Done' : 'Mark done'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>

    <Card title="Completion Heatmap">
      <HeatCalendar month={viewMonth} getDay={getDayCompletion} />
    </Card>

  </Page>
}
