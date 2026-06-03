import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { usePageTitle } from './hooks/usePageTitle'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/appContextCore'
import { AppProvider } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import PageErrorBoundary from './components/ui/PageErrorBoundary'
import Auth from './pages/Auth'
import AppShell from './components/layout/AppShell'
import Skeleton from './components/ui/Skeleton'

const Home = lazy(() => import('./pages/Home'))
const Finance = lazy(() => import('./pages/Finance'))
const TimeFlow = lazy(() => import('./pages/TimeFlow'))
const Study = lazy(() => import('./pages/Study'))
const Habits = lazy(() => import('./pages/Habits'))
const Health = lazy(() => import('./pages/Health'))
const Journal = lazy(() => import('./pages/Journal'))
const AIChat = lazy(() => import('./pages/AIChat'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const ScoringStudio = lazy(() => import('./pages/ScoringStudio'))
const AnalysisBuilder = lazy(() => import('./pages/AnalysisBuilder'))
const CalendarView = lazy(() => import('./pages/CalendarView'))

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        background: 'var(--bg-primary)',
      }}
    >
      <div style={{ fontSize: 48 }}>🧠</div>
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 22,
          color: 'var(--accent-indigo)',
        }}
      >
        Life OS
      </div>
      <div style={{ width: 'min(320px, 100%)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton height={80} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, isLoading, isAuthReady } = useAuth()

  if (isLoading || !isAuthReady) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

function ShellPage({ children }) {
  return (
    <ProtectedRoute>
      <AppProvider>
        <AppShell>
          <PageErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
          </PageErrorBoundary>
        </AppShell>
      </AppProvider>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  const { user, isLoading, isAuthReady } = useAuth()
  usePageTitle()

  if (isLoading || !isAuthReady) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ShellPage><Home /></ShellPage>} />
      <Route path="/finance" element={<ShellPage><Finance /></ShellPage>} />
      <Route path="/timeflow" element={<ShellPage><TimeFlow /></ShellPage>} />
      <Route path="/study" element={<ShellPage><Study /></ShellPage>} />
      <Route path="/habits" element={<ShellPage><Habits /></ShellPage>} />
      <Route path="/health" element={<ShellPage><Health /></ShellPage>} />
      <Route path="/journal" element={<ShellPage><Journal /></ShellPage>} />
      <Route path="/ai" element={<ShellPage><AIChat /></ShellPage>} />
      <Route path="/analytics" element={<ShellPage><Analytics /></ShellPage>} />
      <Route path="/settings" element={<ShellPage><Settings /></ShellPage>} />
      <Route path="/analysis-builder" element={<ShellPage><AnalysisBuilder /></ShellPage>} />
      <Route path="/scoring" element={<ShellPage><ScoringStudio /></ShellPage>} />
      <Route path="/calendar" element={<ShellPage><CalendarView /></ShellPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
