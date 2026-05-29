import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  BarChart2,
  Clock,
  BookOpen,
  MoreHorizontal,
  CheckSquare,
  Heart,
  FileText,
  Bot,
  PieChart,
  Settings,
} from 'lucide-react'

const primaryTabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/finance', icon: BarChart2, label: 'Finance' },
  { to: '/timeflow', icon: Clock, label: 'Time' },
  { to: '/study', icon: BookOpen, label: 'Study' },
]

const moreTabs = [
  { to: '/habits', icon: CheckSquare, label: 'Habits' },
  { to: '/health', icon: Heart, label: 'Health' },
  { to: '/journal', icon: FileText, label: 'Journal' },
  { to: '/ai', icon: Bot, label: 'AI Chat' },
  { to: '/analytics', icon: PieChart, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const morePaths = new Set(moreTabs.map(t => t.to))

export default function BottomNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isMoreActive = morePaths.has(location.pathname)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [drawerOpen])

  function goTo(path) {
    navigate(path)
    setDrawerOpen(false)
  }

  return (
    <>
      {drawerOpen ? (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 150,
            WebkitTapHighlightColor: 'transparent',
          }}
        />
      ) : null}

      {drawerOpen ? (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 160,
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            borderRadius: '20px 20px 0 0',
            padding: '12px 16px calc(16px + env(safe-area-inset-bottom))',
            animation: 'drawerSlideUp 0.25s ease',
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--border)',
              margin: '0 auto 16px',
            }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            {moreTabs.map(({ to, icon: Icon, label }) => (
              <button
                key={to}
                type="button"
                onClick={() => goTo(to)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '14px 8px',
                  minHeight: 72,
                  borderRadius: 14,
                  border: `1px solid ${location.pathname === to ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: location.pathname === to ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
                  color: location.pathname === to ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {primaryTabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '8px 12px',
              minWidth: 56,
              minHeight: 44,
              color: isActive ? 'var(--accent-indigo)' : 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 10,
              fontWeight: 600,
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            })}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setDrawerOpen(open => !open)}
          aria-label="More pages"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            padding: '8px 12px',
            minWidth: 56,
            minHeight: 44,
            background: 'none',
            border: 'none',
            color: isMoreActive || drawerOpen ? 'var(--accent-indigo)' : 'var(--text-muted)',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            transform: isMoreActive || drawerOpen ? 'scale(1.05)' : 'scale(1)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
