import { useEffect, useState } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import KeyboardShortcuts from '../ui/KeyboardShortcuts'
import ScrollToTop from '../ui/ScrollToTop'
import CommandPalette from '../ui/CommandPalette'
import PWAInstallPrompt from '../ui/PWAInstallPrompt'

const MOBILE_BREAKPOINT = 900

export default function AppShell({ children }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

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
