import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Home, BarChart2, Clock, BookOpen, CheckSquare,
  Heart, FileText, Bot, PieChart, Settings, Target, Microscope, CalendarDays,
  PanelLeftClose, PanelLeft, Trophy, Brain, Users, Book, Wind, HelpCircle
} from 'lucide-react'

const navSections = [
  {
    label: 'Core',
    items: [
      { to: '/', icon: Home, label: 'Home', color: 'var(--accent-indigo)' },
      { to: '/finance', icon: BarChart2, label: 'Finance', color: 'var(--finance-color)' },
      { to: '/timeflow', icon: Clock, label: 'Time Flow', color: 'var(--time-color)' },
      { to: '/study', icon: BookOpen, label: 'Study', color: 'var(--study-color)' },
      { to: '/habits', icon: CheckSquare, label: 'Habits', color: 'var(--habit-color)' },
      { to: '/health', icon: Heart, label: 'Health', color: 'var(--health-color)' },
      { to: '/journal', icon: FileText, label: 'Journal', color: 'var(--journal-color)' },
      { to: '/wisdom', icon: BookOpen, label: 'Wisdom Log', color: 'var(--accent-indigo)' },
      { to: '/goals', icon: Target, label: 'Goals & OKRs', color: 'var(--accent-indigo)' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/rpg', icon: Trophy, label: 'Life RPG', color: '#EC4899' },
      { to: '/ai', icon: Bot, label: 'AI Chat', color: 'var(--accent-purple)' },
      { to: '/analytics', icon: PieChart, label: 'Analytics', color: 'var(--accent-cyan)' },
      { to: '/calendar', icon: CalendarDays, label: 'Calendar', color: 'var(--accent-emerald)' },
      { to: '/analysis-builder', icon: Microscope, label: 'Analysis Builder', color: 'var(--accent-purple)' },
      { to: '/scoring', icon: Target, label: 'Scoring Studio', color: 'var(--accent-amber)' },
      { to: '/decisions', icon: HelpCircle, label: 'Decision Journal', color: 'var(--accent-amber)' },
      { to: '/crm', icon: Users, label: 'Relations CRM', color: '#10B981' },
      { to: '/brain', icon: Brain, label: 'Second Brain', color: 'var(--accent-purple)' },
      { to: '/readings', icon: Book, label: 'Reading Tracker', color: 'var(--accent-indigo)' },
      { to: '/meditations', icon: Wind, label: 'Meditation', color: 'var(--accent-cyan)' },
      { to: '/wrapped', icon: Sparkles, label: 'Year in Review', color: '#FCD34D' },
    ],
  },
  {
    label: '',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings', color: 'var(--text-secondary)' },
    ],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? '68px' : '240px',
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: collapsed ? '24px 8px' : '24px 12px',
      position: 'sticky',
      top: 0,
      gap: '2px',
      transition: 'width 0.25s cubic-bezier(0.32, 0.72, 0, 1), padding 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Logo + Collapse toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '10px',
        padding: collapsed ? '0 4px' : '0 12px',
        marginBottom: '20px',
        minHeight: 36,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '24px', flexShrink: 0 }}>🧠</span>
          {!collapsed && (
            <span style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: '800',
              fontSize: '18px',
              color: 'var(--accent-indigo)',
            }}>
              Life OS
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav Sections */}
      {navSections.map((section, sIdx) => (
        <div key={sIdx}>
          {/* Section Label */}
          {section.label && !collapsed && (
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              padding: collapsed ? '8px 4px 6px' : '12px 14px 6px',
              opacity: 0.7,
            }}>
              {section.label}
            </div>
          )}

          {/* Divider between sections */}
          {sIdx > 0 && (
            <div style={{
              height: 1,
              background: 'var(--border)',
              margin: collapsed ? '8px 4px' : '6px 12px',
            }} />
          )}

          {/* Nav Items */}
          {section.items.map(({ to, icon: Icon, label, color }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: collapsed ? '10px' : '10px 14px',
                borderRadius: '12px',
                color: isActive ? color : 'var(--text-secondary)',
                background: isActive ? `${color}18` : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s ease',
                border: isActive ? `1px solid ${color}30` : '1px solid transparent',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              })}
              onMouseEnter={e => {
                const bg = e.currentTarget.style.background
                if (!bg.includes('18')) {
                  e.currentTarget.style.background = 'var(--bg-card)'
                }
              }}
              onMouseLeave={e => {
                const bg = e.currentTarget.style.background
                if (bg === 'var(--bg-card)') {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && label}
            </NavLink>
          ))}
        </div>
      ))}

      {/* Bottom spacer to push settings to bottom */}
      <div style={{ flex: 1 }} />

      {/* Keyboard shortcut hint */}
      {!collapsed && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
          marginTop: 8,
        }}>
          <kbd style={{
            padding: '2px 6px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
          }}>⌘K</kbd>
          <span>Command palette</span>
        </div>
      )}
    </aside>
  )
}