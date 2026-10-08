import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Wallet, BookOpen, CheckSquare, Heart, Clock, FileText, Brain, Target, AlertCircle, Eye, RefreshCw,
} from 'lucide-react'
import { fetchPublicFileData, SHAREABLE_MODULES } from '../services/shareService'
import { AppActionsContext, AppStateContext } from '../context/appContextCore'
import { mergeWithInitialState } from '../context/AppContext'
import { ReadOnlyContext } from '../context/readOnlyContext'
import { useToast } from '../context/toastContextCore'
import { getTodayDateKey } from '../utils/dateTime'
import PageErrorBoundary from '../components/ui/PageErrorBoundary'
import { GeneralSkeleton } from '../components/ui/Skeleton'

// The shared link renders the SAME pages as the app, fed with the shared data
// and wrapped in a read-only context (no saving, edit dialogs blocked, edit buttons hidden).
const PAGES = {
  timeflow: lazy(() => import('./TimeFlow')),
  study: lazy(() => import('./Study')),
  habits: lazy(() => import('./Habits')),
  health: lazy(() => import('./Health')),
  finance: lazy(() => import('./Finance')),
  journal: lazy(() => import('./Journal')),
  wisdom: lazy(() => import('./Wisdom')),
  goals: lazy(() => import('./Goals')),
}

const NAV_META = {
  timeflow: { icon: Clock, color: 'var(--time-color)', label: 'Time Flow' },
  study: { icon: BookOpen, color: 'var(--study-color)', label: 'Study' },
  habits: { icon: CheckSquare, color: 'var(--habit-color)', label: 'Habits' },
  health: { icon: Heart, color: 'var(--health-color)', label: 'Health' },
  finance: { icon: Wallet, color: 'var(--finance-color)', label: 'Finance' },
  journal: { icon: FileText, color: 'var(--journal-color)', label: 'Journal' },
  wisdom: { icon: Brain, color: 'var(--accent-indigo)', label: 'Wisdom' },
  goals: { icon: Target, color: 'var(--accent-indigo)', label: 'Goals' },
}

const MOBILE_BREAKPOINT = 900
const REFRESH_MS = 60000

function timeAgo(date) {
  if (!date) return ''
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

function FullScreen({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: 'var(--text-primary)' }}>
      {children}
    </div>
  )
}

function ErrorCard({ title, message }) {
  return (
    <FullScreen>
      <div style={{ background: 'rgba(15,23,42,0.48)', border: '1px solid rgba(148,163,184,0.10)', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 400 }}>
        <AlertCircle color="#EF4444" size={48} style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontFamily: 'Syne', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{title}</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{message}</p>
      </div>
    </FullScreen>
  )
}

export default function SharedDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const idsParam = params.get('ids') || ''
  const modulesParam = params.get('modules') || ''
  const ownerName = params.get('name') || 'Someone'

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [failedModules, setFailedModules] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [, setTick] = useState(0)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)
  const fetchRef = useRef(null)

  const modules = useMemo(() => {
    const keys = modulesParam.split(',').filter(Boolean)
    return SHAREABLE_MODULES.map(m => m.key).filter(k => keys.includes(k) && PAGES[k])
  }, [modulesParam])

  const [active, setActive] = useState(() => params.get('view') || '')
  const activeModule = modules.includes(active) ? active : (modules.includes('timeflow') ? 'timeflow' : modules[0])

  const linkInvalid = (() => {
    const ids = idsParam.split(',').filter(Boolean)
    const mods = modulesParam.split(',').filter(Boolean)
    return !ids.length || !mods.length || ids.length !== mods.length
  })()

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    document.title = `${ownerName}'s Life OS · read-only`
  }, [ownerName])

  // Re-render "updated x ago" every 15s
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 15000)
    return () => clearInterval(t)
  }, [])

  // ── Fetch shared files (parallel) + silent auto-refresh ──
  useEffect(() => {
    if (linkInvalid) return
    const ids = idsParam.split(',').filter(Boolean)
    const mods = modulesParam.split(',').filter(Boolean)
    let cancelled = false
    let first = true

    const fetchAll = async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      const results = await Promise.allSettled(ids.map(id => fetchPublicFileData(id)))
      if (cancelled) return
      const next = {}
      const failed = []
      let firstError = null
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) next[mods[i]] = r.value
        else { failed.push(mods[i]); firstError = firstError || r.reason }
      })
      if (Object.keys(next).length) {
        setData(prev => (isRefresh && prev ? { ...prev, ...next } : next))
        setFailedModules(failed)
        setLastUpdated(new Date())
        setError(null)
        // Removed the redirect to latest logged day, so it defaults to today.
      } else if (!isRefresh) {
        setError(firstError?.message || 'Failed to load shared data. The link may be invalid or access was revoked.')
      }
      first = false
      setLoading(false)
      setRefreshing(false)
    }
    fetchRef.current = fetchAll
    fetchAll()
    const interval = setInterval(() => fetchAll(true), REFRESH_MS)
    return () => { cancelled = true; clearInterval(interval) }
    // location/navigate intentionally excluded: only the share params should trigger a refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam, modulesParam, linkInvalid])

  // ── Read-only app state & no-op actions ──
  const state = useMemo(() => {
    if (!data) return null
    return {
      ...mergeWithInitialState({ ...data, settings: { profile: { name: ownerName } } }),
      hydrated: true,
      isFromDrive: true,
      syncStatus: 'synced',
      lastSynced: lastUpdated ? lastUpdated.toISOString() : null,
    }
  }, [data, ownerName, lastUpdated])

  const lastInteraction = useRef(0)
  const lastToast = useRef(0)
  useEffect(() => {
    const mark = () => { lastInteraction.current = Date.now() }
    window.addEventListener('pointerdown', mark, true)
    window.addEventListener('keydown', mark, true)
    return () => {
      window.removeEventListener('pointerdown', mark, true)
      window.removeEventListener('keydown', mark, true)
    }
  }, [])

  // Only tell the viewer when THEY tried to change something (not for background effects).
  const notifyReadOnly = useCallback(() => {
    const now = Date.now()
    if (now - lastInteraction.current > 1500 || now - lastToast.current < 2500) return
    lastToast.current = now
    showToast('👀 Read-only view — changes are not saved', 'info')
  }, [showToast])

  const actions = useMemo(() => ({
    setModule: notifyReadOnly,
    patchModule: notifyReadOnly,
    setSettings: notifyReadOnly,
    resetToSample: notifyReadOnly,
    setSyncStatus: () => {},
    refreshFromDrive: () => fetchRef.current?.(true),
  }), [notifyReadOnly])

  const selectModule = (key) => {
    setActive(key)
    const url = new URL(window.location.href)
    url.searchParams.set('view', key)
    window.history.replaceState(window.history.state, '', url.toString())
    window.scrollTo({ top: 0 })
  }

  if (linkInvalid) {
    return <ErrorCard title="Invalid share link" message="This link is incomplete. Ask the owner to send it again." />
  }

  if (loading) {
    return (
      <FullScreen>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 48, animation: 'pulse 2s infinite' }}>🧠</div>
          <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700 }}>Loading {ownerName}'s Life OS…</div>
        </div>
      </FullScreen>
    )
  }

  if (error || !state || !activeModule) {
    return <ErrorCard title="Access Denied" message={error || 'Nothing was shared in this link.'} />
  }

  const Page = PAGES[activeModule]
  const updatedText = `Updated ${timeAgo(lastUpdated)}`

  const refreshButton = (
    <button
      type="button"
      onClick={() => fetchRef.current?.(true)}
      title="Refresh now"
      aria-label="Refresh shared data"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 10, width: 36, height: 36, minHeight: 36, minWidth: 36, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
    >
      <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
    </button>
  )

  const readOnlyPill = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, background: 'rgba(99,102,241,0.14)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)', whiteSpace: 'nowrap' }}>
      <Eye size={12} /> Read-only
    </span>
  )

  const failedNote = failedModules.length > 0 && (
    <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 10, fontSize: 12, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
      Some modules could not be loaded ({failedModules.map(k => NAV_META[k]?.label || k).join(', ')}). Access may have been revoked.
    </div>
  )

  const page = (
    <div className="page-enter readonly-view" key={activeModule}>
      {failedModules.includes(activeModule) ? (
        <div style={{ padding: 24 }}>{failedNote}</div>
      ) : (
        <PageErrorBoundary>
          <Suspense fallback={<GeneralSkeleton />}>
            <Page />
          </Suspense>
        </PageErrorBoundary>
      )}
    </div>
  )

  const providers = (content) => (
    <ReadOnlyContext.Provider value={true}>
      <AppStateContext.Provider value={state}>
        <AppActionsContext.Provider value={actions}>
          {content}
        </AppActionsContext.Provider>
      </AppStateContext.Provider>
    </ReadOnlyContext.Provider>
  )

  // ── Mobile: top bar + bottom nav (same as the app) ──
  if (isMobile) {
    return providers(
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <header style={{
          position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 10,
          padding: 'calc(10px + env(safe-area-inset-top)) 14px 10px',
          background: 'rgba(10,15,30,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(148,163,184,0.08)',
        }}>
          <span style={{ fontSize: 22 }}>🧠</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName}'s Life OS</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{updatedText}</div>
          </div>
          {readOnlyPill}
          {refreshButton}
        </header>
        <main style={{ flex: 1, paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
          {failedModules.length > 0 && !failedModules.includes(activeModule) && <div style={{ padding: '12px 14px 0' }}>{failedNote}</div>}
          {page}
        </main>
        <nav aria-label="Shared modules" style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
          display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
          background: 'rgba(15,23,42,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(148,163,184,0.10)', paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {modules.map(key => {
            const { icon: Icon, color, label } = NAV_META[key]
            const isActive = key === activeModule
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectModule(key)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  flex: modules.length <= 5 ? 1 : '0 0 72px', minHeight: 62, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  background: 'none', border: 'none', cursor: 'pointer', color: isActive ? color : 'var(--text-muted)',
                  fontSize: 10, fontWeight: isActive ? 700 : 500, position: 'relative', WebkitTapHighlightColor: 'transparent',
                }}
              >
                {isActive && <span style={{ position: 'absolute', top: 0, left: '30%', right: '30%', height: 2, borderRadius: 2, background: color }} />}
                <Icon size={20} />
                <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    )
  }

  // ── Desktop: sidebar like the app ──
  return providers(
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <aside style={{
        width: 240, height: '100vh', position: 'sticky', top: 0, alignSelf: 'flex-start',
        background: 'linear-gradient(180deg, var(--bg-secondary) 0%, rgba(10,15,30,0.98) 100%)',
        borderRight: '1px solid rgba(148,163,184,0.06)', display: 'flex', flexDirection: 'column',
        padding: '24px 12px', gap: 2, flexShrink: 0, boxShadow: '4px 0 20px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🧠</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, background: 'linear-gradient(135deg, #6366F1, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Life OS</span>
        </div>
        <div style={{ margin: '0 4px 14px', padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Shared by</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName}</div>
          {readOnlyPill}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 14px', opacity: 0.7 }}>Shared modules</div>
        {modules.map(key => {
          const { icon: Icon, color, label } = NAV_META[key]
          const isActive = key === activeModule
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectModule(key)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, width: '100%', textAlign: 'left',
                color: isActive ? color : 'var(--text-secondary)',
                background: isActive ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent',
                border: isActive ? `1px solid color-mix(in srgb, ${color} 22%, transparent)` : '1px solid transparent',
                fontSize: 14, fontWeight: isActive ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {label}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)' }}>
          <span style={{ flex: 1 }}>{updatedText}<br />Auto-refreshes every minute</span>
          {refreshButton}
        </div>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px', fontSize: 12.5, color: 'var(--text-secondary)',
          background: 'linear-gradient(90deg, rgba(99,102,241,0.10), rgba(236,72,153,0.06))', borderBottom: '1px solid rgba(99,102,241,0.15)',
        }}>
          <Eye size={14} color="#A5B4FC" />
          <span>You are viewing <strong style={{ color: 'var(--text-primary)' }}>{ownerName}</strong>'s Life OS exactly as they see it — read-only, nothing can be changed.</span>
        </div>
        <main style={{ flex: 1, padding: '24px 28px' }}>
          {failedModules.length > 0 && !failedModules.includes(activeModule) && failedNote}
          {page}
        </main>
      </div>
    </div>
  )
}
