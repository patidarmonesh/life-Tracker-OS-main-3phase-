import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, PenLine, CreditCard, Clock, Activity, CalendarDays, Settings2, Sparkles } from 'lucide-react'

export default function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  if (!open) return null

  const items = [
    { name: 'Capture a thought...', icon: PenLine, path: '/capture?type=note' },
    { name: 'Log an expense', icon: CreditCard, path: '/capture?type=expense' },
    { name: 'Log time block', icon: Clock, path: '/capture?type=time' },
    { name: 'Plan your day', icon: CalendarDays, path: '/plan' },
    { name: 'View Insights', icon: Activity, path: '/insights' },
    { name: 'Ask LifeOS AI', icon: Sparkles, path: '/ask' },
    { name: 'Settings', icon: Settings2, path: '/settings' },
  ]

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  function runCommand(path) {
    navigate(path)
    setOpen(false)
    setSearch('')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 18, 16, 0.8)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'start center', paddingTop: '10vh', padding: '0 1rem'
    }} onClick={() => setOpen(false)}>
      
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: '500px',
        border: '1px solid var(--line-strong)', borderRadius: '0px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--line-strong)' }}>
          <Search size={18} color="var(--text-3)" style={{ marginRight: '0.75rem' }} />
          <input 
            autoFocus
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            style={{ 
              background: 'transparent', border: 'none', outline: 'none', 
              color: 'var(--text-1)', width: '100%', fontSize: '1rem', fontFamily: 'var(--font-display)' 
            }}
          />
          <kbd style={{ fontSize: '0.7rem', color: 'var(--text-3)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: '4px' }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>No commands found.</div>
          ) : (
            filtered.map((item, idx) => (
              <button key={idx} onClick={() => runCommand(item.path)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', background: 'transparent', border: 'none',
                  color: 'var(--text-2)', cursor: 'pointer', textAlign: 'left',
                  borderRadius: '0px', transition: 'background 0.1s'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-1)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
              >
                <item.icon size={16} />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
