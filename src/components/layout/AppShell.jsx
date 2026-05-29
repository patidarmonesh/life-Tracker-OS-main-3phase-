import { useEffect, useState } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'

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
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar isMobile />
        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
          {children}
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar isMobile={false} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
