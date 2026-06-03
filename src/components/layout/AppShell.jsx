import { useEffect, useState } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import KeyboardShortcuts from '../ui/KeyboardShortcuts'
import ScrollToTop from '../ui/ScrollToTop'
import CommandPalette from '../ui/CommandPalette'
import PWAInstallPrompt from '../ui/PWAInstallPrompt'
import { useAppState } from '../../context/appHooks'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

const MOBILE_BREAKPOINT = 900

export default function AppShell({ children }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )
  const state = useAppState()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const activeFloating = state.wisdom?.entries?.find(e => e.isFloating)

  const renderFloatingWisdom = () => {
    if (!activeFloating) return null
    return (
      <div
        onClick={() => navigate('/wisdom')}
        style={{
          background: 'linear-gradient(90deg, rgba(99,102,241,0.06) 0%, rgba(236,72,153,0.06) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(99,102,241,0.15)',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          zIndex: 90,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        className="floating-wisdom-banner"
      >
        <Sparkles size={13} color="#EC4899" style={{ animation: 'spin 10s linear infinite', flexShrink: 0 }} />
        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          color: 'var(--text-secondary)',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Focus Wisdom:
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          fontStyle: 'italic',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          "{activeFloating.text}"
        </span>
        {activeFloating.source && (
          <span style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}>
            — {activeFloating.source}
          </span>
        )}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        minHeight: '100vh',
        overscrollBehavior: 'contain',
      }}>
        <TopBar isMobile />
        {renderFloatingWisdom()}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}>
          <div className="page-enter">
            {children}
          </div>
        </main>
        <BottomNav />
        <KeyboardShortcuts />
        <ScrollToTop />
        <CommandPalette />
        <PWAInstallPrompt />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar isMobile={false} />
        {renderFloatingWisdom()}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>
      <KeyboardShortcuts />
      <ScrollToTop />
      <CommandPalette />
      <PWAInstallPrompt />
    </div>
  )
}

