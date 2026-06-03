import { useEffect, useRef, useState } from 'react'
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
  Target,
  Microscope,
  CalendarDays,
  X,
} from 'lucide-react'

const primaryTabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/finance', icon: BarChart2, label: 'Finance' },
  { to: '/timeflow', icon: Clock, label: 'Time' },
  { to: '/study', icon: BookOpen, label: 'Study' },
]

const moreTabs = [
  { to: '/habits', icon: CheckSquare, label: 'Habits', color: 'var(--habit-color)' },
  { to: '/health', icon: Heart, label: 'Health', color: 'var(--health-color)' },
  { to: '/journal', icon: FileText, label: 'Journal', color: 'var(--journal-color)' },
  { to: '/ai', icon: Bot, label: 'AI Chat', color: 'var(--accent-purple)' },
  { to: '/analytics', icon: PieChart, label: 'Analytics', color: 'var(--accent-cyan)' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar', color: 'var(--accent-emerald)' },
  { to: '/analysis-builder', icon: Microscope, label: 'Analysis', color: 'var(--accent-purple)' },
  { to: '/scoring', icon: Target, label: 'Scoring', color: 'var(--accent-amber)' },
  { to: '/settings', icon: Settings, label: 'Settings', color: 'var(--text-secondary)' },
]

const morePaths = new Set(moreTabs.map(t => t.to))

export default function BottomNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isMoreActive = morePaths.has(location.pathname)
  const drawerRef = useRef(null)
  const touchStartY = useRef(null)

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [drawerOpen])

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  function goTo(path) {
    navigate(path)
    setDrawerOpen(false)
  }

  // Swipe-down to close drawer
  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e) {
    if (touchStartY.current === null) return
    const diff = e.touches[0].clientY - touchStartY.current
    if (diff > 60) {
      setDrawerOpen(false)
      touchStartY.current = null
    }
  }

  function handleTouchEnd() {
    touchStartY.current = null
  }

  // Find current "more" page label for active state display
  const currentMorePage = moreTabs.find(t => t.to === location.pathname)

  return (
    <>
      {/* Backdrop */}
      {drawerOpen ? (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 150,
            WebkitTapHighlightColor: 'transparent',
            animation: 'modalBackdropFadeIn 0.2s ease',
          }}
        />
      ) : null}

      {/* More Drawer — Bottom Sheet */}
      {drawerOpen ? (
        <div
          ref={drawerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 160,
            background: 'var(--bg-card)',
            borderTop: '1px solid rgba(148,163,184,0.12)',
            borderRadius: '24px 24px 0 0',
            padding: '8px 16px calc(16px + env(safe-area-inset-bottom))',
            animation: 'drawerSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            boxShadow: '0 -20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* Drag handle */}
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--text-muted)',
              margin: '4px auto 12px',
              opacity: 0.5,
            }}
          />

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            padding: '0 4px',
          }}>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'Syne, sans-serif',
            }}>
              All Pages
            </span>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: 10,
                padding: 8,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Grid — 3 columns for 9 items */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            {moreTabs.map(({ to, icon: Icon, label, color }) => {
              const isActive = location.pathname === to
              return (
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
                    padding: '14px 6px',
                    minHeight: 72,
                    borderRadius: 16,
                    border: `1px solid ${isActive ? (color || 'var(--accent-indigo)') + '44' : 'var(--border)'}`,
                    background: isActive
                      ? (color || 'var(--accent-indigo)') + '18'
                      : 'rgba(255,255,255,0.03)',
                    color: isActive ? (color || 'var(--accent-indigo)') : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Bottom Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid rgba(148,163,184,0.08)',
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
              padding: '6px 14px',
              minWidth: 56,
              minHeight: 44,
              color: isActive ? 'var(--accent-indigo)' : 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 10,
              fontWeight: 600,
              position: 'relative',
              transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
              WebkitTapHighlightColor: 'transparent',
            })}
          >
            {({ isActive }) => (
              <>
                {/* Active indicator pill — Material 3 style */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    width: 32,
                    height: 3,
                    borderRadius: 3,
                    background: 'var(--accent-indigo)',
                    animation: 'fadeSlideIn 0.2s ease',
                  }} />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* More button */}
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
            padding: '6px 14px',
            minWidth: 56,
            minHeight: 44,
            background: 'none',
            border: 'none',
            color: isMoreActive || drawerOpen ? 'var(--accent-indigo)' : 'var(--text-muted)',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* Active indicator for More */}
          {(isMoreActive && !drawerOpen) && (
            <div style={{
              position: 'absolute',
              top: 2,
              width: 32,
              height: 3,
              borderRadius: 3,
              background: 'var(--accent-indigo)',
              animation: 'fadeSlideIn 0.2s ease',
            }} />
          )}
          <MoreHorizontal size={20} strokeWidth={isMoreActive || drawerOpen ? 2.5 : 2} />
          <span>{currentMorePage ? currentMorePage.label : 'More'}</span>
        </button>
      </nav>
    </>
  )
}
