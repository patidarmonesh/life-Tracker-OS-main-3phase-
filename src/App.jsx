import { lazy, Suspense } from 'react'
import './components/calendar.css'
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

import { useLocation } from 'react-router-dom'
import { HomeSkeleton, FinanceSkeleton, AnalyticsSkeleton, GeneralSkeleton } from './components/ui/Skeleton'

const Home = lazy(() => import('./pages/Home'))
const Finance = lazy(() => import('./pages/Finance'))
const TimeFlow = lazy(() => import('./pages/TimeFlow'))
const Study = lazy(() => import('./pages/Study'))
const Habits = lazy(() => import('./pages/Habits'))
const Health = lazy(() => import('./pages/Health'))
const Journal = lazy(() => import('./pages/Journal'))
const AskLifeOS = lazy(() => import('./pages/AskLifeOS'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const ScoringStudio = lazy(() => import('./pages/ScoringStudio'))
const AnalysisBuilder = lazy(() => import('./pages/AnalysisBuilder'))

const Calendar = lazy(() => import('./pages/Calendar'))
const Plan = lazy(() => import('./pages/Plan'))
const Capture = lazy(() => import('./pages/Capture'))
const Me = lazy(() => import('./pages/Me'))
const Wisdom = lazy(() => import('./pages/Wisdom'))
const Goals = lazy(() => import('./pages/Goals'))
const DecisionJournal = lazy(() => import('./pages/DecisionJournal'))
const RelationshipCRM = lazy(() => import('./pages/RelationshipCRM'))
const SecondBrain = lazy(() => import('./pages/SecondBrain'))
const ReadingTracker = lazy(() => import('./pages/ReadingTracker'))
const Meditation = lazy(() => import('./pages/Meditation'))
const YearInReview = lazy(() => import('./pages/YearInReview'))
const FocusMode = lazy(() => import('./pages/FocusMode'))
const SharedDashboard = lazy(() => import('./pages/SharedDashboard'))
const SetupWizard = lazy(() => import('./pages/SetupWizard'))

/* Mobile "More" page — links to all areas and tools not on the bottom nav */
import { Link as RouterLink } from 'react-router-dom'
function MorePage() {
  const sections = [
    { title: 'Areas', links: [
      { to: '/time', label: 'Time Flow', emoji: '⏱' },
      { to: '/study', label: 'Study', emoji: '📚' },
      { to: '/habits', label: 'Routines', emoji: '✅' },
      { to: '/health', label: 'Health & Sleep', emoji: '❤️' },
      { to: '/journal', label: 'Journal', emoji: '📝' },
      { to: '/goals', label: 'Goals', emoji: '🎯' },
      { to: '/brain', label: 'Second Brain', emoji: '🧠' },
    ]},
    { title: 'Tools', links: [
      { to: '/insights', label: 'Insights', emoji: '📊' },
      { to: '/calendar', label: 'Calendar', emoji: '📅' },
      { to: '/ai', label: 'Ask LifeOS', emoji: '💬' },
      { to: '/wisdom', label: 'Wisdom', emoji: '🕉️' },
      { to: '/readings', label: 'Reading', emoji: '📖' },
      { to: '/meditations', label: 'Meditation', emoji: '🧘' },
      { to: '/decisions', label: 'Decisions', emoji: '🤔' },
      { to: '/crm', label: 'Relationships', emoji: '👥' },
      { to: '/focus', label: 'Focus Mode', emoji: '🎧' },
    ]},
    { title: '', links: [
      { to: '/me', label: 'Me', emoji: '👤' },
      { to: '/settings', label: 'Settings', emoji: '⚙️' },
    ]},
  ]
  return <div className="pb-24 max-md:pb-32 mb-12" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem' }}>More</h1>
    {sections.map((s, i) => <div key={i}>
      {s.title && <div style={{ fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>{s.title}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {s.links.map(l => <RouterLink key={l.to} to={l.to} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '.7rem .8rem',
          borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)',
          textDecoration: 'none', color: 'var(--text-1)', fontWeight: 600, fontSize: '.88rem',
        }}><span style={{ fontSize: '1.2rem' }}>{l.emoji}</span>{l.label}</RouterLink>)}
      </div>
    </div>)}
  </div>
}



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
      <div className="brand-mark" aria-hidden="true">L</div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
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
  const location = useLocation()

  const skeletonFallback = (() => {
    switch (location.pathname) {
      case '/':
        return <HomeSkeleton />
      case '/finance':
        return <FinanceSkeleton />
      case '/analytics':
        return <AnalyticsSkeleton />
      default:
        return <GeneralSkeleton />
    }
  })()

  return (
    <ProtectedRoute>
      <AppProvider>
        <AppShell>
          <PageErrorBoundary>
            <Suspense fallback={skeletonFallback}>{children}</Suspense>
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
      <Route path="/plan" element={<ShellPage><Plan /></ShellPage>} />
      <Route path="/plan/review" element={<ShellPage><Plan /></ShellPage>} />
      <Route path="/capture" element={<ShellPage><Capture /></ShellPage>} />
      <Route path="/insights" element={<ShellPage><Analytics /></ShellPage>} />
      <Route path="/me" element={<ShellPage><Me /></ShellPage>} />

      {/* Primary nav routes */}
      <Route path="/money" element={<ShellPage><Finance /></ShellPage>} />
      <Route path="/time" element={<ShellPage><TimeFlow /></ShellPage>} />

      {/* Areas */}
      <Route path="/study" element={<ShellPage><Study /></ShellPage>} />
      <Route path="/habits" element={<ShellPage><Habits /></ShellPage>} />
      <Route path="/health" element={<ShellPage><Health /></ShellPage>} />
      <Route path="/journal" element={<ShellPage><Journal /></ShellPage>} />
      <Route path="/goals" element={<ShellPage><Goals /></ShellPage>} />
      <Route path="/brain" element={<ShellPage><SecondBrain /></ShellPage>} />

      {/* Tools */}
      <Route path="/ai" element={<ShellPage><AskLifeOS /></ShellPage>} />
      <Route path="/ask" element={<ShellPage><AskLifeOS /></ShellPage>} />
      <Route path="/settings" element={<ShellPage><Settings /></ShellPage>} />
      <Route path="/calendar" element={<ShellPage><Calendar /></ShellPage>} />
      <Route path="/wisdom" element={<ShellPage><Wisdom /></ShellPage>} />
      <Route path="/decisions" element={<ShellPage><DecisionJournal /></ShellPage>} />
      <Route path="/crm" element={<ShellPage><RelationshipCRM /></ShellPage>} />
      <Route path="/readings" element={<ShellPage><ReadingTracker /></ShellPage>} />
      <Route path="/meditations" element={<ShellPage><Meditation /></ShellPage>} />
      <Route path="/wrapped" element={<ShellPage><YearInReview /></ShellPage>} />
      <Route path="/focus" element={<ShellPage><FocusMode /></ShellPage>} />
      <Route path="/analysis-builder" element={<ShellPage><AnalysisBuilder /></ShellPage>} />
      <Route path="/scoring" element={<ShellPage><ScoringStudio /></ShellPage>} />

      {/* More page (mobile) */}
      <Route path="/more" element={<ShellPage><MorePage /></ShellPage>} />

      {/* Redirects for old routes */}
      <Route path="/finance" element={<Navigate to="/money" replace />} />
      <Route path="/timeflow" element={<Navigate to="/time" replace />} />
      <Route path="/analytics" element={<Navigate to="/insights" replace />} />
      <Route path="/rpg" element={<Navigate to="/me" replace />} />

      {/* External */}
      <Route path="/shared" element={<Suspense fallback={<LoadingScreen />}><SharedDashboard /></Suspense>} />
      <Route path="/setup" element={<Suspense fallback={<LoadingScreen />}><SetupWizard /></Suspense>} />
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
