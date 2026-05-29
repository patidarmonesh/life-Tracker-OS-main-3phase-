import { NavLink } from 'react-router-dom'
import {
  Home, BarChart2, Clock, BookOpen, CheckSquare,
  Heart, FileText, Bot, PieChart, Settings
} from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Home', color: 'var(--accent-indigo)' },
  { to: '/finance', icon: BarChart2, label: 'Finance', color: 'var(--finance-color)' },
  { to: '/timeflow', icon: Clock, label: 'Time Flow', color: 'var(--time-color)' },
  { to: '/study', icon: BookOpen, label: 'Study', color: 'var(--study-color)' },
  { to: '/habits', icon: CheckSquare, label: 'Habits', color: 'var(--habit-color)' },
  { to: '/health', icon: Heart, label: 'Health', color: 'var(--health-color)' },
  { to: '/journal', icon: FileText, label: 'Journal', color: 'var(--journal-color)' },
  { to: '/ai', icon: Bot, label: 'AI Chat', color: 'var(--accent-purple)' },
  { to: '/analytics', icon: PieChart, label: 'Analytics', color: 'var(--accent-cyan)' },
  { to: '/settings', icon: Settings, label: 'Settings', color: 'var(--text-secondary)' },
]

export default function Sidebar() {
  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 12px',
      position: 'sticky',
      top: 0,
      gap: '4px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', marginBottom: '24px' }}>
        <span style={{ fontSize: '24px' }}>🧠</span>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '18px', color: 'var(--accent-indigo)' }}>
          Life OS
        </span>
      </div>

      {/* Nav Items */}
      {navItems.map(({ to, icon: Icon, label, color }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '12px',
            color: isActive ? color : 'var(--text-secondary)',
            background: isActive ? `${color}18` : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: isActive ? '600' : '400',
            transition: 'all 0.15s ease',
            border: isActive ? `1px solid ${color}30` : '1px solid transparent',
          })}
          onMouseEnter={e => { if (!e.currentTarget.style.background.includes('18')) e.currentTarget.style.background = 'var(--bg-card)' }}
          onMouseLeave={e => { if (!e.currentTarget.style.background.includes('18')) e.currentTarget.style.background = 'transparent' }}
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </aside>
  )
}