import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Cloud, CloudOff, Loader, CheckCircle, LogOut, Search } from 'lucide-react'
import { useAppState } from '../../context/appHooks'
import { useAuth } from '../../context/appContextCore'

const PAGE_TITLES = {
  '/': 'Home',
  '/finance': 'Finance',
  '/timeflow': 'Time Flow',
  '/study': 'Study',
  '/habits': 'Habits',
  '/health': 'Health',
  '/journal': 'Journal',
  '/ai': 'AI Chat',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/scoring': 'Scoring Studio',
  '/analysis-builder': 'Analysis Builder',
  '/calendar': 'Calendar',
}

export default function TopBar({ isMobile = false }) {
  const state = useAppState()
  const { user, logout } = useAuth()
  const location = useLocation()
  const { syncStatus, lastSynced } = state

  const pageTitle = PAGE_TITLES[location.pathname] || 'Life OS'

  const indicator = useMemo(() => {
    if (syncStatus === 'syncing') {
      return { icon: Loader, label: 'Syncing...', color: '#f59e0b', spin: true }
    }
    if (syncStatus === 'offline') {
      return { icon: CloudOff, label: 'Using local cache', color: 'var(--text-secondary)', spin: false }
    }
    if (syncStatus === 'auth_required') {
      return { icon: CloudOff, label: 'Drive reconnect needed', color: '#f97316', spin: false }
    }
    if (syncStatus === 'synced') {
      return {
        icon: CheckCircle,
        label: lastSynced
          ? `Saved ${formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}`
          : 'Saved',
        color: '#10b981',
        spin: false,
      }
    }
    return { icon: Cloud, label: 'Ready', color: 'var(--text-secondary)', spin: false }
  }, [syncStatus, lastSynced])

  const Icon = indicator.icon
  const displayName = user?.name?.trim() || 'Signed in'
  const displayEmail = user?.email?.trim() || ''
  const avatarUrl = user?.picture?.trim() || ''
  const fallbackInitial = (displayName[0] || 'U').toUpperCase()

  return (
    <header
      style={{
        height: isMobile ? 52 : 56,
        background: isMobile
          ? 'rgba(17,24,39,0.85)'
          : 'var(--bg-secondary)',
        backdropFilter: isMobile ? 'blur(20px) saturate(180%)' : 'blur(10px)',
        WebkitBackdropFilter: isMobile ? 'blur(20px) saturate(180%)' : 'blur(10px)',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile
          ? '0 16px 0 16px'
          : '0 20px',
        paddingTop: isMobile ? 'env(safe-area-inset-top)' : '0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left side — Logo + Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {isMobile && <div style={{ fontSize: 18, flexShrink: 0 }}>🧠</div>}

        {isMobile ? (
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {pageTitle}
          </div>
        ) : (
          <div style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}>
            {pageTitle !== 'Home' && (
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Life OS</span>
                <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>/</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pageTitle}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side — Sync + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12, flexShrink: 0 }}>
        {/* Sync indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: indicator.color,
            fontSize: 12,
            padding: isMobile ? '5px 8px' : '6px 10px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            transition: 'all 0.3s ease',
          }}
          title={indicator.label}
        >
          <Icon size={13} className={indicator.spin ? 'animate-spin' : ''} />
          {!isMobile ? <span>{indicator.label}</span> : null}
        </div>

        {/* User avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 10 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              style={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border-focus)',
              }}
            />
          ) : (
            <div
              style={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                color: 'white',
              }}
            >
              {fallbackInitial}
            </div>
          )}

          {!isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                {displayName}
              </span>
              {displayEmail ? (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{displayEmail}</span>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              minHeight: 44,
              minWidth: 44,
              borderRadius: 10,
              transition: 'color 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
