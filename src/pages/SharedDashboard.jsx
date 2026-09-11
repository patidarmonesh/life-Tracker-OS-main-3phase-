import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchPublicFileData, SHAREABLE_MODULES } from '../services/shareService'
import { format, subDays, addDays } from 'date-fns'
import {
  Wallet, BookOpen, CheckSquare, Heart, Clock, FileText, Brain, Target, AlertCircle,
  ChevronLeft, ChevronRight, Bot, Sparkles, Send, CalendarDays, Loader2
} from 'lucide-react'

const iconMap = {
  finance: Wallet,
  study: BookOpen,
  habits: CheckSquare,
  health: Heart,
  timeflow: Clock,
  journal: FileText,
  wisdom: Brain,
  goals: Target
}

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

export default function SharedDashboard() {
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState({ name: '', modules: [] })
  const [lastUpdated, setLastUpdated] = useState(null)
  // Calendar + AI state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showCalendar, setShowCalendar] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const aiInputRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const ids = params.get('ids')?.split(',') || []
    const modulesParam = params.get('modules')?.split(',') || []
    const name = params.get('name') || 'Someone'

    if (ids.length === 0 || modulesParam.length === 0 || ids.length !== modulesParam.length) {
      setError('Invalid share link')
      setLoading(false)
      return
    }

    setMeta({ name, modules: modulesParam })

    const fetchAll = async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true)
        const results = {}
        for (let i = 0; i < ids.length; i++) {
          const modKey = modulesParam[i]
          const fileData = await fetchPublicFileData(ids[i])
          results[modKey] = fileData
        }
        setData(results)
        setLastUpdated(new Date())
        setError(null)
      } catch (err) {
        console.error('Shared dashboard fetch error:', err)
        if (!isRefresh) {
          setError(err.message || 'Failed to load shared data. The link may be invalid or access was revoked.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAll()

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchAll(true), 60000)
    return () => clearInterval(interval)
  }, [location])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 48, animation: 'pulse 2s infinite' }}>🧠</div>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700 }}>Loading Shared Data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}>
        <div style={{
          background: 'rgba(15,23,42,0.48)',
          border: '1px solid rgba(148,163,184,0.10)',
          borderRadius: 20,
          padding: 32,
          textAlign: 'center',
          maxWidth: 400
        }}>
          <AlertCircle color="#EF4444" size={48} style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: 'Syne', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{error}</p>
        </div>
      </div>
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]

  const renderModuleCard = (modKey) => {
    const modData = data[modKey]
    if (!modData) return null

    const modConfig = SHAREABLE_MODULES.find(m => m.key === modKey)
    const Icon = iconMap[modKey] || FileText
    
    let content = null

    if (modKey === 'finance') {
      const todayTrans = modData.transactions?.filter(t => t.date === todayStr) || []
      const todaySpend = todayTrans.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : 0), 0)
      const budget = modData.settings?.dailyBudget || 0
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Today's Spend</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 }}>₹{todaySpend.toFixed(0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Daily Budget</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 16 }}>₹{budget.toFixed(0)}</span>
          </div>
        </div>
      )
    }

    if (modKey === 'study') {
      const todaySessions = modData.sessions?.filter(s => s.date === todayStr) || []
      const todayMins = todaySessions.reduce((acc, s) => acc + s.duration, 0)
      const hours = Math.floor(todayMins / 60)
      const mins = todayMins % 60
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Today's Study</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 }}>{hours}h {mins}m</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sessions</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 16 }}>{todaySessions.length}</span>
          </div>
        </div>
      )
    }

    if (modKey === 'habits') {
      const activeHabits = modData.habits?.filter(h => !h.archived) || []
      const completedToday = activeHabits.filter(h => h.history?.[todayStr]).length
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Habits Completed</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 }}>{completedToday} / {activeHabits.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {activeHabits.slice(0, 3).map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8 }}>
                <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>{h.name}</span>
                <span style={{ fontSize: 14 }}>{h.history?.[todayStr] ? '✅' : '⏳'}</span>
              </div>
            ))}
            {activeHabits.length > 3 && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>+ {activeHabits.length - 3} more</div>}
          </div>
        </div>
      )
    }

    if (modKey === 'health') {
      const todayHealth = modData.logs?.[todayStr] || {}
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Water</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>{todayHealth.water || 0} glasses</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Steps</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>{todayHealth.steps || 0}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sleep</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>{todayHealth.sleep || 0} hrs</span>
          </div>
        </div>
      )
    }

    if (modKey === 'timeflow') {
      const CATEGORY_COLORS = {
        'Sleep': '#8B5CF6', 'Morning Routine': '#F59E0B', 'Exercise': '#10B981',
        'Study': '#3B82F6', 'Deep Work': '#1D4ED8', 'Meals': '#F97316',
        'Social Media': '#EF4444', 'Entertainment': '#EC4899', 'Travel': '#06B6D4',
        'Self-Care': '#84CC16', 'Waste Time': '#DC2626', 'Other': '#6B7280',
        'Talk with Dost': '#A78BFA', 'Freelance': '#10B981',
      }
      const allEntries = modData.entries || []
      const dayEntries = allEntries
        .filter(e => e.date === selectedDate)
        .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
      const productiveMins = dayEntries.filter(e => !e.isWaste).reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)
      const wasteMins = dayEntries.filter(e => e.isWaste).reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)
      const totalMins = productiveMins + wasteMins

      // Get dates that have entries (for calendar dots)
      const datesWithEntries = new Set(allEntries.map(e => e.date))
      const isToday = selectedDate === todayStr
      const selDateObj = new Date(selectedDate + 'T00:00:00')

      // AI analysis function
      const runAIAnalysis = async (customQ = '') => {
        if (!GEMINI_KEY) { setAiAnalysis('⚠️ AI analysis not available (no API key configured)'); return }
        setAiLoading(true)
        setAiAnalysis('')
        try {
          const timeline = dayEntries.map(e =>
            `${e.start}-${e.end}: ${e.name} (${e.category}, ${e.durationMinutes}min, ${e.isWaste ? 'WASTE' : 'productive'}, score:${e.productivityScore}/5)${e.notes ? ' — ' + e.notes : ''}`
          ).join('\n')

          const prompt = customQ
            ? `Here is ${meta.name}'s time log for ${selectedDate}:\n\n${timeline}\n\nQuestion from their accountability partner: ${customQ}\n\nAnswer in 2-3 short paragraphs. Be specific with times and activities. Use a friendly tone.`
            : `Analyze ${meta.name}'s day (${selectedDate}):\n\n${timeline}\n\nGive a brief analysis (3-4 bullet points max) covering:\n1. What went well\n2. What could improve\n3. One specific actionable suggestion\n\nKeep it concise, friendly, and specific. Reference actual activities by name. Use emojis.`

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            }
          )
          const json = await res.json()
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available'
          setAiAnalysis(text)
        } catch (err) {
          setAiAnalysis('❌ Failed to get AI analysis: ' + err.message)
        } finally {
          setAiLoading(false)
        }
      }

      // Mini calendar: show last 14 days
      const calendarDays = []
      for (let i = 13; i >= 0; i--) {
        const d = subDays(new Date(), i)
        const ds = format(d, 'yyyy-MM-dd')
        calendarDays.push({ date: ds, day: format(d, 'EEE'), num: format(d, 'd'), hasEntries: datesWithEntries.has(ds), isSelected: ds === selectedDate, isToday: ds === todayStr })
      }

      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Date Navigator ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button onClick={() => setSelectedDate(format(subDays(selDateObj, 1), 'yyyy-MM-dd'))}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', WebkitTapHighlightColor: 'transparent' }}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
                {isToday ? 'Today' : format(selDateObj, 'EEEE')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {format(selDateObj, 'd MMMM yyyy')}
              </div>
            </div>
            <button onClick={() => { if (selectedDate < todayStr) setSelectedDate(format(addDays(selDateObj, 1), 'yyyy-MM-dd')) }}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '10px', padding: '8px', cursor: selectedDate < todayStr ? 'pointer' : 'not-allowed', color: selectedDate < todayStr ? 'var(--text-secondary)' : 'rgba(148,163,184,0.2)', display: 'flex', WebkitTapHighlightColor: 'transparent', opacity: selectedDate < todayStr ? 1 : 0.4 }}>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setShowCalendar(!showCalendar)}
              style={{ background: showCalendar ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showCalendar ? 'rgba(99,102,241,0.3)' : 'rgba(148,163,184,0.1)'}`, borderRadius: '10px', padding: '8px', cursor: 'pointer', color: showCalendar ? '#818CF8' : 'var(--text-secondary)', display: 'flex', WebkitTapHighlightColor: 'transparent' }}>
              <CalendarDays size={18} />
            </button>
          </div>

          {/* ── Mini Calendar Strip ── */}
          {showCalendar && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', padding: '8px', background: 'rgba(15,23,42,0.4)', borderRadius: '14px', border: '1px solid rgba(148,163,184,0.06)' }}>
              {calendarDays.map(cd => (
                <button key={cd.date} onClick={() => { setSelectedDate(cd.date); setShowCalendar(false) }}
                  style={{
                    padding: '6px 2px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: cd.isSelected ? 'rgba(99,102,241,0.2)' : 'transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{cd.day}</span>
                  <span style={{ fontSize: '14px', fontWeight: cd.isSelected ? 800 : 600, color: cd.isSelected ? '#818CF8' : cd.isToday ? '#10B981' : 'var(--text-primary)' }}>{cd.num}</span>
                  {cd.hasEntries && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: cd.isSelected ? '#818CF8' : '#10B981' }} />}
                </button>
              ))}
            </div>
          )}

          {/* ── Stats Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { label: 'Productive', value: `${Math.floor(productiveMins/60)}h ${productiveMins%60}m`, color: '#10B981' },
              { label: 'Wasted', value: `${Math.floor(wasteMins/60)}h ${wasteMins%60}m`, color: '#EF4444' },
              { label: 'Logged', value: `${dayEntries.length} entries`, color: '#6366F1' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px 8px', borderRadius: '12px', textAlign: 'center', background: `${s.color}10`, border: `1px solid ${s.color}25` }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          {totalMins > 0 && (
            <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${(productiveMins/totalMins)*100}%`, background: '#10B981', transition: 'width 0.5s ease' }} />
              <div style={{ width: `${(wasteMins/totalMins)*100}%`, background: '#EF4444', transition: 'width 0.5s ease' }} />
            </div>
          )}

          {/* ── Timeline Header ── */}
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Syne, sans-serif', borderBottom: '1px solid rgba(148,163,184,0.08)', paddingBottom: '8px' }}>
            Timeline — {isToday ? 'Today' : format(selDateObj, 'd MMM yyyy')}
          </div>

          {/* ── Timeline Entries ── */}
          {dayEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>📋</div>
              <div style={{ fontSize: '13px' }}>No entries logged for {isToday ? 'today' : format(selDateObj, 'd MMM')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {dayEntries.map((entry, idx) => {
                const catColor = CATEGORY_COLORS[entry.category] || '#6B7280'
                const hrs = Math.floor((entry.durationMinutes || 0) / 60)
                const mins = (entry.durationMinutes || 0) % 60
                const durationStr = hrs > 0 ? `${hrs}.${Math.round(mins/6)}h` : `${mins}m`
                return (
                  <div key={entry.id || idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    <div style={{ width: '42px', flexShrink: 0, textAlign: 'right', paddingTop: '14px' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontWeight: 600 }}>{entry.start}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '16px', flexShrink: 0 }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: catColor, marginTop: '16px', flexShrink: 0, boxShadow: `0 0 8px ${catColor}40` }} />
                      {idx < dayEntries.length - 1 && <div style={{ width: '2px', flex: 1, background: 'rgba(148,163,184,0.1)', minHeight: '20px' }} />}
                    </div>
                    <div style={{ flex: 1, marginBottom: '4px', padding: '12px 14px', borderRadius: '14px', background: entry.isWaste ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${entry.isWaste ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.08)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{entry.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11.5px', color: catColor, fontWeight: 600, fontStyle: 'italic' }}>{entry.category}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>• {entry.start}–{entry.end} • {durationStr}</span>
                            {entry.isWaste && <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700, background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '4px' }}>• waste ⚠️</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '3px', paddingTop: '4px', flexShrink: 0 }}>
                          {[1,2,3,4,5].map(n => (
                            <div key={n} style={{ width: '7px', height: '7px', borderRadius: '50%', background: n <= (entry.productivityScore || 0) ? (entry.isWaste ? '#EF4444' : catColor) : 'rgba(148,163,184,0.15)' }} />
                          ))}
                        </div>
                      </div>
                      {entry.notes && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, borderTop: '1px solid rgba(148,163,184,0.06)', paddingTop: '6px' }}>{entry.notes}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── AI Coach Section ── */}
          {dayEntries.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Bot size={16} color="#A78BFA" />
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-secondary)' }}>AI Coach</span>
              </div>

              {/* Quick analyse button */}
              <button onClick={() => runAIAnalysis()} disabled={aiLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '11px 16px', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.25)',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.05))',
                  color: '#A78BFA', fontSize: '13px', fontWeight: 700, cursor: aiLoading ? 'wait' : 'pointer',
                  width: '100%', fontFamily: 'DM Sans, sans-serif',
                  opacity: aiLoading ? 0.7 : 1, WebkitTapHighlightColor: 'transparent',
                }}>
                {aiLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
                {aiLoading ? 'Analysing...' : '✨ Analyse This Day'}
              </button>

              {/* Custom question */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input ref={aiInputRef} value={aiQuestion} onChange={e => setAiQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && aiQuestion.trim()) { runAIAnalysis(aiQuestion.trim()); setAiQuestion('') } }}
                  placeholder="Ask about this day... e.g. 'How can I reduce waste time?'"
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '12px', fontSize: '13px',
                    background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(148,163,184,0.1)',
                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'DM Sans, sans-serif',
                  }} />
                <button onClick={() => { if (aiQuestion.trim()) { runAIAnalysis(aiQuestion.trim()); setAiQuestion('') } }}
                  disabled={!aiQuestion.trim() || aiLoading}
                  style={{
                    padding: '10px 14px', borderRadius: '12px', border: 'none',
                    background: aiQuestion.trim() ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.04)',
                    color: '#fff', cursor: aiQuestion.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', opacity: aiQuestion.trim() ? 1 : 0.4,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <Send size={16} />
                </button>
              </div>

              {/* AI Response */}
              {aiAnalysis && (
                <div style={{
                  padding: '14px 16px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.04))',
                  border: '1px solid rgba(139,92,246,0.12)',
                  fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Sparkles size={12} /> AI Insight
                  </div>
                  {aiAnalysis}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    if (modKey === 'journal') {
      const entries = modData.entries || []
      const latest = entries.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      content = latest ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Latest Entry ({format(new Date(latest.createdAt), 'MMM d, yyyy')})</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>{latest.title || 'Untitled'}</span>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {latest.content?.replace(/<[^>]+>/g, '')}
          </p>
        </div>
      ) : (
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No entries yet.</span>
      )
    }

    if (modKey === 'wisdom') {
      const quotes = modData.quotes || []
      const random = quotes.length > 0 ? quotes[Math.floor(Math.random() * quotes.length)] : null
      content = random ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontStyle: 'italic' }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 15 }}>"{random.text}"</span>
          {random.author && <span style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'right' }}>- {random.author}</span>}
        </div>
      ) : (
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No wisdom saved.</span>
      )
    }

    if (modKey === 'goals') {
      const activeGoals = modData.goals?.filter(g => g.status === 'active') || []
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Active Goals</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 }}>{activeGoals.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeGoals.slice(0,2).map(g => (
              <div key={g.id} style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{g.title}</div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                  <div style={{ width: `${g.progress || 0}%`, height: '100%', background: 'var(--accent-indigo)', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div key={modKey} style={{
        background: 'rgba(15,23,42,0.48)',
        border: '1px solid rgba(148,163,184,0.10)',
        borderRadius: 20,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(99,102,241,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-indigo)'
          }}>
            <Icon size={20} />
          </div>
          <h3 style={{ margin: 0, fontFamily: 'Syne', color: 'var(--text-primary)', fontSize: 18 }}>
            {modConfig?.label || modKey}
          </h3>
        </div>
        {content}
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: '"DM Sans", sans-serif',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        flex: 1
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 24,
          borderBottom: '1px solid rgba(148,163,184,0.10)'
        }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', margin: '0 0 8px 0', fontSize: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>📊 Shared by {meta.name}</span>
            </h1>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Live snapshot of selected modules
            </span>
            {lastUpdated && (
              <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', marginTop: '4px' }}>
                Updated {lastUpdated.toLocaleTimeString()} • auto-refreshes every 60s
              </span>
            )}
          </div>
          <div style={{
            background: 'rgba(99,102,241,0.1)',
            color: 'var(--accent-indigo)',
            padding: '4px 12px',
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Read-Only
          </div>
        </header>

        {/* Full-width modules (timeline) */}
        {meta.modules.filter(m => m === 'timeflow').map(mod => renderModuleCard(mod))}

        {/* Grid modules */}
        {meta.modules.filter(m => m !== 'timeflow').length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16
          }}>
            {meta.modules.filter(m => m !== 'timeflow').map(mod => renderModuleCard(mod))}
          </div>
        )}

        <footer style={{
          marginTop: 'auto',
          paddingTop: 48,
          paddingBottom: 24,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 14
        }}>
          Powered by <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Life OS 🧠</span>
        </footer>
      </div>
    </div>
  )
}
