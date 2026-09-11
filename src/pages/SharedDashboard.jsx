import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchPublicFileData, SHAREABLE_MODULES } from '../services/shareService'
import { format } from 'date-fns'
import {
  Wallet, BookOpen, CheckSquare, Heart, Clock, FileText, Brain, Target, AlertCircle
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

export default function SharedDashboard() {
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState({ name: '', modules: [] })

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

    const fetchAll = async () => {
      try {
        const results = {}
        for (let i = 0; i < ids.length; i++) {
          const modKey = modulesParam[i]
          const fileData = await fetchPublicFileData(ids[i])
          results[modKey] = fileData
        }
        setData(results)
      } catch (err) {
        setError('Failed to load shared data. The user may have revoked access.')
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
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
            <span style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 }}>${todaySpend.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Daily Budget</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 16 }}>${budget.toFixed(2)}</span>
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
      const todayLogs = modData.logs?.filter(l => l.date === todayStr) || []
      const productiveMins = todayLogs.filter(l => l.type === 'productive').reduce((acc, l) => acc + l.duration, 0)
      const wasteMins = todayLogs.filter(l => l.type === 'waste').reduce((acc, l) => acc + l.duration, 0)
      
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Productive Time</span>
            <span style={{ color: '#10B981', fontSize: 20, fontWeight: 700 }}>{Math.floor(productiveMins/60)}h {productiveMins%60}m</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wasted Time</span>
            <span style={{ color: '#EF4444', fontSize: 20, fontWeight: 700 }}>{Math.floor(wasteMins/60)}h {wasteMins%60}m</span>
          </div>
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

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16
        }}>
          {meta.modules.map(mod => renderModuleCard(mod))}
        </div>

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
