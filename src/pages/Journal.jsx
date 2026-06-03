import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid
} from 'recharts'
import { Plus, Search, Pencil } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import TagInput from '../components/ui/TagInput'
import EmptyState from '../components/ui/EmptyState'
import { useToast } from '../context/toastContextCore'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Very Low', color: '#EF4444' },
  { value: 2, emoji: '😕', label: 'Low', color: '#F97316' },
  { value: 3, emoji: '😐', label: 'Neutral', color: '#F59E0B' },
  { value: 4, emoji: '🙂', label: 'Good', color: '#10B981' },
  { value: 5, emoji: '😄', label: 'Great', color: '#3B82F6' },
]

const PROMPTS = [
  'What made today meaningful?',
  'What drained your energy today?',
  'What are you avoiding right now?',
  'What am I proud of today?',
  'What small win happened today?',
  'What should I do differently tomorrow?',
]

export default function Journal() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)
  const [activeTab, setActiveTab] = useState('entries')
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState(PROMPTS[0])
  const [form, setForm] = useState({
    date: today,
    title: '',
    content: '',
    mood: 4,
    energy: 3,
    gratitude: '',
    tags: [],
  })

  const entries = state.journal?.entries || []

  const allTags = useMemo(() => [...new Set(entries.flatMap(e => e.tags || []))], [entries])

  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))

  const filteredEntries = sortedEntries.filter(entry => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      entry.title?.toLowerCase().includes(q) ||
      entry.content?.toLowerCase().includes(q) ||
      entry.gratitude?.toLowerCase().includes(q) ||
      (entry.tags || []).some(tag => tag.toLowerCase().includes(q))
    )
  })

  const last14Mood = Array.from({ length: 14 }, (_, i) => {
    const d = toDateKey(subDays(new Date(), 13 - i), timezone)
    const dayEntries = entries.filter(e => e.date === d)
    const avgMood = dayEntries.length
      ? +(dayEntries.reduce((a, e) => a + (e.mood || 0), 0) / dayEntries.length).toFixed(1)
      : null
    return {
      day: formatDateKey(d, timezone, { month: 'short', day: 'numeric' }),
      mood: avgMood,
    }
  })

  const tagCounts = {}
  entries.forEach(entry => {
    ;(entry.tags || []).forEach(tag => {
      const clean = tag.trim()
      if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const moodBreakdown = MOODS.map(m => ({
    name: m.label,
    emoji: m.emoji,
    value: entries.filter(e => e.mood === m.value).length,
    color: m.color,
  }))

  const averageMood = entries.length
    ? +(entries.reduce((a, e) => a + (e.mood || 0), 0) / entries.length).toFixed(1)
    : 0

  function resetForm() {
    setForm({
      date: today,
      title: '',
      content: '',
      mood: 4,
      energy: 3,
      gratitude: '',
      tags: [],
    })
  }

  function closeModal() {
    setShowNewModal(false)
    setEditingEntry(null)
    resetForm()
  }

  function startEdit(entry) {
    setEditingEntry(entry)
    setForm({
      date: entry.date,
      title: entry.title || '',
      content: entry.content || '',
      mood: entry.mood ?? 4,
      energy: entry.energy ?? 3,
      gratitude: entry.gratitude || '',
      tags: entry.tags || [],
    })
    setShowNewModal(true)
  }

  function saveEntry() {
    if (!form.content.trim()) return

    const payload = {
      date: form.date,
      title: form.title.trim() || 'Untitled Entry',
      content: form.content.trim(),
      mood: Number(form.mood),
      energy: Number(form.energy),
      gratitude: form.gratitude.trim(),
      tags: form.tags,
      updatedAt: new Date().toISOString(),
    }

    if (editingEntry) {
      setModule('journal', {
        ...state.journal,
        entries: entries.map(e => (e.id === editingEntry.id ? { ...e, ...payload } : e)),
      })
      showToast('Entry updated ✓', 'success')
    } else {
      const newEntry = {
        id: uuid(),
        ...payload,
        createdAt: new Date().toISOString(),
      }
      setModule('journal', {
        ...state.journal,
        entries: [newEntry, ...entries],
      })
      showToast('Entry saved ✓', 'success')
    }

    closeModal()
  }

  function deleteEntry(id) {
    const prev = entries
    setModule('journal', {
      ...state.journal,
      entries: entries.filter(e => e.id !== id),
    })
    showToast('Entry deleted', 'warning', {
      undo: () => setModule('journal', { ...state.journal, entries: prev }),
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
  }

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const tabStyle = (active) => ({
    padding: '8px 18px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--accent-indigo)' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400',
    fontSize: '14px',
    fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid var(--accent-indigo)' : '2px solid transparent',
  })

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>📓 Journal</h1>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus size={16} /> New Entry
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)' }}>
        {['entries', 'insights'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab === 'entries' ? 'Entries' : 'Insights'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeTab === 'entries' && (
          <>
            <Card>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search entries, gratitude, tags..."
                    style={{ ...inputStyle, paddingLeft: '34px' }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {filteredEntries.length} entries
                </div>
              </div>
            </Card>

            {filteredEntries.length === 0 ? (
              <Card>
                <EmptyState
                  icon="✍️"
                  title="No journal entries yet"
                  subtitle="Start writing daily reflections, wins, and thoughts."
                  action={{ label: '✍️ Write First Entry', onClick: () => setShowNewModal(true) }}
                />
              </Card>
            ) : (
              filteredEntries.map(entry => {
                const moodObj = MOODS.find(m => m.value === entry.mood) || MOODS[2]
                return (
                  <Card key={entry.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>{entry.title}</h3>
                          <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '999px', background: `${moodObj.color}20`, color: moodObj.color }}>
                            {moodObj.emoji} {moodObj.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {entry.date} • Energy {entry.energy}/5
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          aria-label="Edit entry"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                            padding: 8, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <ConfirmDeleteButton onConfirm={() => deleteEntry(entry.id)} label="Delete journal entry" />
                      </div>
                    </div>

                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.7', marginTop: '12px', whiteSpace: 'pre-wrap' }}>
                      {entry.content}
                    </div>

                    {entry.gratitude && (
                      <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                          Gratitude
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {entry.gratitude}
                        </div>
                      </div>
                    )}

                    {entry.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                        {entry.tags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </>
        )}

        {activeTab === 'insights' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Total Entries', value: entries.length, color: 'var(--accent-indigo)', icon: '📘' },
                { label: 'Average Mood', value: averageMood || '—', color: '#10B981', icon: '🙂' },
                { label: 'Entries This Week', value: entries.filter(e => {
                    const d = new Date(e.date + 'T00:00:00')
                    return d >= subDays(new Date(), 6)
                  }).length, color: '#F59E0B', icon: '🗓️' },
              ].map(card => (
                <Card key={card.label} style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px' }}>{card.icon}</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: card.color, marginTop: '4px' }}>
                    {card.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{card.label}</div>
                </Card>
              ))}
            </div>

            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Mood Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={last14Mood} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[1, 5]} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="mood" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: '#6366F1', r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>
                Mood Distribution
            </h3>

            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={moodBreakdown} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                <XAxis dataKey="emoji" tick={{ fontSize: 18 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                    contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px'
                    }}
                />
                <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            </Card>              

            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>Top Tags</h3>
              {topTags.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No tags yet.</div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {topTags.map(([tag, count]) => (
                    <div
                      key={tag}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '999px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      #{tag} <span style={{ color: 'var(--text-muted)' }}>({count})</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Modal isOpen={showNewModal} onClose={closeModal} title={editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Solid workday, weird mental fog"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Prompt</label>
            <select
              value={selectedPrompt}
              onChange={e => setSelectedPrompt(e.target.value)}
              style={inputStyle}
            >
              {PROMPTS.map(prompt => (
                <option key={prompt} value={prompt}>{prompt}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Entry</label>
            <textarea
              rows={7}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder={selectedPrompt}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Mood</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: form.mood === m.value ? m.color : 'var(--border)',
                      background: form.mood === m.value ? `${m.color}20` : 'transparent',
                      cursor: 'pointer',
                      fontSize: '18px',
                    }}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Energy</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => setForm(f => ({ ...f, energy: n }))}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: form.energy >= n ? '#F59E0B' : 'var(--border)',
                      background: form.energy >= n ? 'rgba(245,158,11,0.15)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: form.energy >= n ? '#F59E0B' : 'var(--text-muted)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Gratitude</label>
            <input
              value={form.gratitude}
              onChange={e => setForm(f => ({ ...f, gratitude: e.target.value }))}
              placeholder="One thing you're grateful for today"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Tags</label>
            <TagInput
              tags={form.tags || []}
              onChange={tags => setForm(f => ({ ...f, tags }))}
              allTags={allTags}
              placeholder="Add tags..."
            />
          </div>

          <Button onClick={saveEntry} disabled={!form.content.trim()}>
            {editingEntry ? 'Update Entry' : 'Save Entry'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
