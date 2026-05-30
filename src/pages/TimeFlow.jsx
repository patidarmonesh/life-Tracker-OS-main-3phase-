import { useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from 'recharts'
import { Plus, Sparkles, Pencil } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/ToastContext'
import { getGeminiApiKey } from '../services/geminiService'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'

const CATEGORY_COLORS = {
  'Sleep': '#8B5CF6',
  'Morning Routine': '#F59E0B',
  'Exercise': '#10B981',
  'Study': '#3B82F6',
  'Deep Work': '#1D4ED8',
  'Meals': '#F97316',
  'Social Media': '#EF4444',
  'Entertainment': '#EC4899',
  'Travel': '#06B6D4',
  'Self-Care': '#84CC16',
  'Waste Time': '#DC2626',
  'Other': '#6B7280',
}

const WASTE_CATEGORIES = ['Social Media', 'Waste Time', 'Entertainment']

export default function TimeFlow() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)
  const categories = state.settings?.preferences?.timeCategories?.length
    ? state.settings.preferences.timeCategories
    : Object.keys(CATEGORY_COLORS)
  const defaultCategory = categories[0] || 'Study'
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeTab, setActiveTab] = useState('day')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [showAIModal, setShowAIModal] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [form, setForm] = useState({
    name: '', category: defaultCategory, start: '09:00', end: '10:00',
    mood: 3, productivityScore: 3, isWaste: false, notes: '',
  })

  const allEntries = state.timeflow.entries || []
  const dayEntries = allEntries
    .filter(e => e.date === selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start))

  // ── Calculations ──────────────────────────────────────────
  const productiveMins = dayEntries.filter(e => !e.isWaste && e.category !== 'Sleep' && e.category !== 'Meals').reduce((a, e) => a + e.durationMinutes, 0)
  const wasteMins = dayEntries.filter(e => e.isWaste || WASTE_CATEGORIES.includes(e.category)).reduce((a, e) => a + e.durationMinutes, 0)
  const sleepMins = dayEntries.filter(e => e.category === 'Sleep').reduce((a, e) => a + e.durationMinutes, 0)
  const loggedMins = dayEntries.reduce((a, e) => a + e.durationMinutes, 0)
  const unloggedMins = Math.max(0, 1440 - loggedMins)

  // Donut data
  const catTotals = {}
  dayEntries.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.durationMinutes })
  const donutData = Object.entries(catTotals).map(([name, value]) => ({ name, value }))

  // Weekly data (last 7 days)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = toDateKey(subDays(new Date(), 6 - i), timezone)
    const entries = allEntries.filter(e => e.date === d)
    const prod = entries.filter(e => !e.isWaste && e.category !== 'Sleep' && e.category !== 'Meals').reduce((a, e) => a + e.durationMinutes, 0)
    const waste = entries.filter(e => e.isWaste || WASTE_CATEGORIES.includes(e.category)).reduce((a, e) => a + e.durationMinutes, 0)
    return { day: formatDateKey(d, timezone, { weekday: 'short' }), productive: +(prod / 60).toFixed(1), waste: +(waste / 60).toFixed(1) }
  })

  function resetForm() {
    setForm({
      name: '', category: defaultCategory, start: '09:00', end: '10:00',
      mood: 3, productivityScore: 3, isWaste: false, notes: '',
    })
  }

  function closeModal() {
    setShowAddModal(false)
    setEditingEntry(null)
    resetForm()
  }

  function startEdit(entry) {
    setEditingEntry(entry)
    setForm({
      name: entry.name || '',
      category: entry.category,
      start: entry.start,
      end: entry.end,
      mood: entry.mood ?? 3,
      productivityScore: entry.productivityScore ?? 3,
      isWaste: !!entry.isWaste,
      notes: entry.notes || '',
    })
    setShowAddModal(true)
  }

  function saveEntry(entryData) {
    const [sh, sm] = entryData.start.split(':').map(Number)
    const [eh, em] = entryData.end.split(':').map(Number)
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm)
    if (durationMinutes <= 0) return alert('End time must be after start time')

    const payload = {
      date: selectedDate,
      start: entryData.start,
      end: entryData.end,
      durationMinutes,
      name: entryData.name || entryData.category,
      category: entryData.category,
      productivityScore: entryData.productivityScore,
      mood: entryData.mood,
      isWaste: entryData.isWaste || WASTE_CATEGORIES.includes(entryData.category),
      isBadHabit: entryData.isWaste,
      notes: entryData.notes || '',
      source: editingEntry?.source || 'manual',
      updatedAt: new Date().toISOString(),
    }

    if (editingEntry) {
      const updated = allEntries.map(e =>
        e.id === editingEntry.id ? { ...e, ...payload } : e
      )
      setModule('timeflow', { ...state.timeflow, entries: updated })
      showToast('Entry updated ✓', 'success')
    } else {
      const newEntry = { id: uuid(), ...payload, createdAt: new Date().toISOString() }
      setModule('timeflow', { ...state.timeflow, entries: [...allEntries, newEntry] })
      showToast('Entry saved ✓', 'success')
    }

    closeModal()
  }

  function deleteEntry(id) {
    const removed = allEntries.find(e => e.id === id)
    if (!removed) return
    const prev = allEntries
    setModule('timeflow', { ...state.timeflow, entries: allEntries.filter(e => e.id !== id) })
    showToast('Entry deleted', 'warning', {
      undo: () => setModule('timeflow', { ...state.timeflow, entries: prev }),
    })
  }

  async function analyseWithAI() {
    if (!freeText.trim()) return
    setAiLoading(true)
    setAiResult(null)
    const apiKey = getGeminiApiKey()

    if (!apiKey) {
      setAiLoading(false)
      setAiResult({
        error: true,
        message: 'No Gemini API key found. Go to Settings → API Keys to add your key.',
      })
      return
    }

    try {
      const categoryList = categories.join('|')
      const prompt = `You are a personal life analyst. Extract structured time entries from the user's daily log text. Return ONLY valid JSON, no markdown, no explanation.

Return format:
{
  "activities": [
    {
      "start": "HH:MM",
      "end": "HH:MM",
      "name": "activity name",
      "category": "one of: ${categoryList}",
      "productivityScore": 1-5,
      "isWaste": boolean,
      "notes": ""
    }
  ],
  "insights": ["insight 1", "insight 2"],
  "badHabits": ["bad habit if any"],
  "goodHabits": ["good habit if any"],
  "totalWasteMinutes": number,
  "totalProductiveMinutes": number,
  "suggestions": ["suggestion 1", "suggestion 2"]
}

User's day: ${freeText}`

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      )
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setAiResult(parsed)
      } else {
        setAiResult({ error: true, message: 'Could not parse AI response. Try again.' })
      }
    } catch {
      setAiResult({ error: true, message: 'AI request failed. Check your API key.' })
    }
    setAiLoading(false)
  }

  function importAIEntries() {
    if (!aiResult?.activities) return
    const newEntries = aiResult.activities
      .filter(a => a.start && a.end)
      .map(a => {
        const [sh, sm] = a.start.split(':').map(Number)
        const [eh, em] = a.end.split(':').map(Number)
        return {
          id: uuid(), date: selectedDate,
          start: a.start, end: a.end,
          durationMinutes: (eh * 60 + em) - (sh * 60 + sm),
          name: a.name, category: a.category,
          productivityScore: a.productivityScore || 3,
          mood: 3, isWaste: a.isWaste || WASTE_CATEGORIES.includes(a.category),
          isBadHabit: a.isWaste, notes: a.notes || '',
          source: 'ai-parsed', createdAt: new Date().toISOString(),
        }
      })
      .filter(e => e.durationMinutes > 0)

    setModule('timeflow', { ...state.timeflow, entries: [...allEntries.filter(e => e.date !== selectedDate), ...newEntries] })
    setShowAIModal(false)
    setFreeText('')
    setAiResult(null)
  }

  // ── Styles ────────────────────────────────────────────────
  const tabStyle = (active) => ({
    padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--accent-amber)' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid var(--accent-amber)' : '2px solid transparent',
  })
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }
  const labelStyle = {
    fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700',
    marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>⏱️ Time Flow</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setShowAIModal(true)}>
            ✨ Analyse with AI
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Entry
          </Button>
        </div>
      </div>

      {/* Date Picker */}
      <div style={{ padding: '12px 24px 0' }}>
        <input
          type="date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ ...inputStyle, width: 'auto', fontSize: '13px', padding: '8px 12px' }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '12px 24px 0', borderBottom: '1px solid var(--border)' }}>
        {['day', 'week'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab === 'day' ? 'Day View' : 'Week View'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ══ DAY VIEW ══════════════════════════════════════ */}
        {activeTab === 'day' && <>

          {/* Summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { label: 'Productive', value: `${(productiveMins/60).toFixed(1)}h`, color: '#3B82F6' },
              { label: 'Waste', value: `${(wasteMins/60).toFixed(1)}h`, color: '#EF4444' },
              { label: 'Sleep', value: `${(sleepMins/60).toFixed(1)}h`, color: '#8B5CF6' },
              { label: 'Unlogged', value: `${(unloggedMins/60).toFixed(1)}h`, color: 'var(--text-muted)' },
            ].map(({ label, value, color }) => (
              <Card key={label} style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
              </Card>
            ))}
          </div>

          {/* Timeline */}
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>
              Timeline — {selectedDate === today ? 'Today' : selectedDate}
            </h3>
            {dayEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '15px' }}>No entries for this day</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Use "Analyse with AI" to log your day in plain text, or add entries manually</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {dayEntries.map((entry, idx) => (
                  <TimelineEntry key={entry.id} entry={entry} onDelete={deleteEntry} onEdit={startEdit} isLast={idx === dayEntries.length - 1} />
                ))}
              </div>
            )}
          </Card>

          {/* Donut chart */}
          {donutData.length > 0 && (
            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Today's Time Distribution</h3>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#6B7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${(v/60).toFixed(1)}h`} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '140px' }}>
                  {donutData.map(({ name, value }) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: CATEGORY_COLORS[name] || '#6B7280', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', flex: 1, color: 'var(--text-secondary)' }}>{name}</span>
                      <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{(value/60).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>}

        {/* ══ WEEK VIEW ══════════════════════════════════════ */}
        {activeTab === 'week' && <>
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>Productive vs Waste Time (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, name) => [`${v}h`, name === 'productive' ? 'Productive' : 'Waste']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="productive" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: '#3B82F6', r: 4 }} />
                <Line type="monotone" dataKey="waste" stroke="#EF4444" strokeWidth={2.5} dot={{ fill: '#EF4444', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ width: '12px', height: '3px', background: '#3B82F6', borderRadius: '2px' }} /> Productive
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ width: '12px', height: '3px', background: '#EF4444', borderRadius: '2px' }} /> Waste
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[
              { label: 'Avg Productive/day', value: `${(weeklyData.reduce((a, d) => a + d.productive, 0) / 7).toFixed(1)}h`, color: '#3B82F6' },
              { label: 'Avg Waste/day', value: `${(weeklyData.reduce((a, d) => a + d.waste, 0) / 7).toFixed(1)}h`, color: '#EF4444' },
              { label: 'Best Day', value: weeklyData.reduce((a, d) => d.productive > a.productive ? d : a, weeklyData[0])?.day || '-', color: '#10B981' },
              { label: 'Worst Day', value: weeklyData.reduce((a, d) => d.waste > a.waste ? d : a, weeklyData[0])?.day || '-', color: '#F43F5E' },
            ].map(({ label, value, color }) => (
              <Card key={label} style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
              </Card>
            ))}
          </div>
        </>}

      </div>

      {/* ══ ADD ENTRY MODAL ════════════════════════════════════ */}
      <Modal isOpen={showAddModal} onClose={closeModal} title={editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Activity Name</label>
            <input style={inputStyle} placeholder="e.g. Deep Work on ML project" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, isWaste: WASTE_CATEGORIES.includes(e.target.value) }))}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Start Time</label>
              <input style={inputStyle} type="time" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>End Time</label>
              <input style={inputStyle} type="time" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Productivity Score</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, productivityScore: n }))} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                  borderColor: form.productivityScore >= n ? '#3B82F6' : 'var(--border)',
                  background: form.productivityScore >= n ? 'rgba(59,130,246,0.15)' : 'transparent',
                  cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                  color: form.productivityScore >= n ? '#3B82F6' : 'var(--text-muted)',
                }}>
                  {['😫','😕','😐','🙂','😄'][n-1]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input style={inputStyle} placeholder="Any notes..." value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button onClick={() => saveEntry(form)} disabled={!form.start || !form.end}>
            {editingEntry ? 'Update Entry' : 'Save Entry'}
          </Button>
        </div>
      </Modal>

      {/* ══ AI ANALYSE MODAL ═══════════════════════════════════ */}
      <Modal isOpen={showAIModal} onClose={() => { setShowAIModal(false); setAiResult(null) }} title="✨ Analyse Day with AI">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', lineHeight: '1.6' }}>
            Write your day in plain language. AI will extract structured time entries automatically.
            <br /><br />
            <span style={{ color: 'var(--accent-amber)', fontWeight: '600' }}>Example:</span> "6am woke up, 6-6:30 meditation, 7-12 studied ML, 12-1 lunch and reels, 1-3 nap..."
          </div>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Write your entire day here..."
            rows={6}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
              fontFamily: 'DM Sans, sans-serif', resize: 'vertical', lineHeight: '1.6',
            }}
          />

          {!aiResult && (
            <Button onClick={analyseWithAI} disabled={aiLoading || !freeText.trim()}>
              {aiLoading ? '⏳ Analysing...' : '✨ Analyse with Gemini AI'}
            </Button>
          )}

          {aiResult?.error && (
            <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px', fontSize: '13px', color: '#F43F5E' }}>
              ⚠️ {aiResult.message}
            </div>
          )}

          {aiResult && !aiResult.error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Activities preview */}
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Extracted {aiResult.activities?.length || 0} Activities
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {aiResult.activities?.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: CATEGORY_COLORS[a.category] || '#6B7280', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{a.start}–{a.end}</span>
                      <span style={{ flex: 1, fontWeight: '600' }}>{a.name}</span>
                      {a.isWaste && <span style={{ fontSize: '11px', color: '#F43F5E' }}>waste</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights */}
              {aiResult.insights?.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-indigo)', marginBottom: '6px' }}>💡 AI Insights</div>
                  {aiResult.insights.map((insight, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>• {insight}</div>
                  ))}
                </div>
              )}

              {aiResult.badHabits?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#EF4444', marginBottom: '4px' }}>⚠️ Bad Habits</div>
                  {aiResult.badHabits.map((h, i) => <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>• {h}</div>)}
                </div>
              )}

              {aiResult.suggestions?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>🚀 Suggestions</div>
                  {aiResult.suggestions.map((s, i) => <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>• {s}</div>)}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button onClick={importAIEntries} style={{ flex: 1 }}>✅ Import to Timeline</Button>
                <Button variant="secondary" onClick={() => setAiResult(null)}>Re-analyse</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  )
}

// ── Timeline Entry Component ──────────────────────────────
function TimelineEntry({ entry, onDelete, onEdit, isLast }) {
  const color = CATEGORY_COLORS[entry.category] || '#6B7280'
  const hrs = (entry.durationMinutes / 60).toFixed(1)

  return (
    <div style={{ display: 'flex', gap: '0', position: 'relative' }}>
      {/* Time column */}
      <div style={{ width: '60px', flexShrink: 0, paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', textAlign: 'right', paddingRight: '12px' }}>
          {entry.start}
        </div>
      </div>

      {/* Line + dot */}
      <div style={{ width: '20px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, marginTop: '14px', flexShrink: 0, zIndex: 1 }} />
        {!isLast && <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '2px' }} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: '12px', paddingLeft: '10px' }}>
        <div style={{ padding: '10px 12px', background: `${color}12`, border: `1px solid ${color}30`, borderRadius: '10px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{entry.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
              <span style={{ color }}>{entry.category}</span>
              <span>• {entry.start}–{entry.end}</span>
              <span>• {hrs}h</span>
              {entry.isWaste && <span style={{ color: '#EF4444' }}>• waste ⚠️</span>}
            </div>
            {entry.notes && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{entry.notes}</div>}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{ width: '6px', height: '6px', borderRadius: '50%', background: n <= entry.productivityScore ? color : 'var(--border)' }} />
            ))}
            <button
              type="button"
              onClick={() => onEdit?.(entry)}
              aria-label="Edit entry"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                padding: 8, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-indigo)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Pencil size={13} />
            </button>
            <ConfirmDeleteButton onConfirm={() => onDelete(entry.id)} size={13} label="Delete time entry" />
          </div>
        </div>
      </div>
    </div>
  )
}
