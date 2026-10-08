import { useState, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { NotebookPen, Plus, Trash2, Calendar } from 'lucide-react'
import { Page, Card, Button, Tabs, EmptyState, Field, HeatCalendar, Sheet, Chips } from '../ui/index'
import { useAppState, useAppActions } from '../context/appHooks'
import { getTodayDateKey } from '../utils/dateTime'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'

const MOODS = [
  { key: 1, emoji: '😞', label: 'Very Low', color: '#EF4444' },
  { key: 2, emoji: '😕', label: 'Low', color: '#F97316' },
  { key: 3, emoji: '😐', label: 'Neutral', color: '#F59E0B' },
  { key: 4, emoji: '🙂', label: 'Good', color: '#10B981' },
  { key: 5, emoji: '😄', label: 'Great', color: '#3B82F6' },
]

export default function Journal() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const entries = useMemo(() => state.journal?.entries || [], [state.journal?.entries])
  const [activeTab, setActiveTab] = useState('entries')
  const [month, setMonth] = useState(today.slice(0, 7))

  const [showComposer, setShowComposer] = useState(false)
  const [text, setText] = useState('')
  const [mood, setMood] = useState(4)

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [entries])

  function saveEntry() {
    if (!text.trim()) return
    const newEntry = {
      id: uuid(),
      date: today,
      text: text.trim(),
      mood,
      tags: [],
      createdAt: new Date().toISOString()
    }
    setModule('journal', {
      ...state.journal,
      entries: [newEntry, ...entries]
    })
    setText('')
    setMood(4)
    setShowComposer(false)
  }

  function deleteEntry(id) {
    if (!window.confirm('Delete this entry?')) return
    setModule('journal', {
      ...state.journal,
      entries: entries.filter(e => e.id !== id)
    })
  }

  return (
    <Page 
      title="Journal" 
      icon={NotebookPen} 
      color="#8B5CF6"
      actions={<Button variant="primary" icon={Plus} onClick={() => setShowComposer(true)}>New Entry</Button>}
    >
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'entries', label: 'Entries', icon: NotebookPen, badge: entries.length },
          { key: 'calendar', label: 'Calendar', icon: Calendar }
        ]}
      />

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {activeTab === 'entries' && (
          sortedEntries.length === 0 ? (
            <EmptyState 
              icon="📓" 
              title="No journal entries yet" 
              text="Start reflecting on your days." 
              action={<Button onClick={() => setShowComposer(true)}>Write Entry</Button>} 
            />
          ) : (
            sortedEntries.map(entry => {
              const m = MOODS.find(x => x.key === entry.mood) || MOODS[2]
              const content = entry.text || entry.content || ''
              return (
                <Card key={entry.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)' }}>{entry.date}</span>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '0', background: `color-mix(in srgb, ${m.color} 15%, transparent)`, color: m.color, fontWeight: 600 }}>
                        {m.emoji} {m.label}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      className="ui-btn ghost icon sm" 
                      onClick={() => deleteEntry(entry.id)} 
                      aria-label="Delete"
                    >
                      <Trash2 size={16} style={{ color: 'var(--danger-ink)' }} />
                    </button>
                  </div>
                  
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-1)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    {content}
                  </div>
                  
                  {entry.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                      {entry.tags.map(t => (
                        <span key={t} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '0', background: 'var(--bg-3)', color: 'var(--text-2)' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })
          )
        )}

        {activeTab === 'calendar' && (
          <Card>
            <HeatCalendar
              month={month}
              onMonthChange={setMonth}
              title="Mood Calendar"
              today={today}
              getDay={(d) => {
                const dayEntries = entries.filter(e => e.date === d)
                if (!dayEntries.length) return { status: 'unknown' }
                const avgMood = Math.round(dayEntries.reduce((a, e) => a + (e.mood || 3), 0) / dayEntries.length)
                const m = MOODS.find(x => x.key === avgMood) || MOODS[2]
                return {
                  status: 'value',
                  value: String(avgMood),
                  cellBg: m.color,
                  ink: '#fff',
                  aria: `Mood: ${m.label}`
                }
              }}
            />
          </Card>
        )}
      </div>

      <Sheet 
        open={showComposer} 
        onClose={() => setShowComposer(false)} 
        title="New Journal Entry"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowComposer(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveEntry} disabled={!text.trim()}>Save Entry</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="How are you feeling?">
            <Chips
              options={MOODS}
              value={mood}
              onChange={setMood}
            />
          </Field>
          <Field label="What's on your mind?">
            <textarea
              className="ui-input"
              rows={8}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Write your thoughts here..."
              style={{ resize: 'vertical', width: '100%', fontFamily: 'inherit' }}
            />
          </Field>
        </div>
      </Sheet>
    
    <Card title="Mood Trends">
      <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[{day:'1st', mood:3}, {day:'2nd', mood:4}, {day:'3rd', mood:2}, {day:'4th', mood:5}, {day:'5th', mood:4}]} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[1, 5]} ticks={[1,2,3,4,5]} />
            <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0' }} />
            <Line type="monotone" dataKey="mood" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: 'var(--bg-card)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  
  </Page>
  )
}
