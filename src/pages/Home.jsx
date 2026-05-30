import { useEffect, useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { calcLifeScore } from '../utils/scoreCalculator'
import ScoreRing from '../components/ui/ScoreRing'
import Card from '../components/ui/Card'
import { Plus, Sparkles, Zap, ArrowRight } from 'lucide-react'
import { formatCurrencyAmount } from '../utils/currency'
import { getTodayDateKey } from '../utils/dateTime'

export default function Home() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { user } = useAuth()
  const navigate = useNavigate()
  const timezone = state.settings?.profile?.timezone
  const currency = state.settings?.profile?.currency || 'INR'
  const today = getTodayDateKey(timezone)
  const [fabOpen, setFabOpen] = useState(false)
  const [isCompactHero, setIsCompactHero] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 920 : false
  )

  useEffect(() => {
    const onResize = () => setIsCompactHero(window.innerWidth < 920)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const scores = useMemo(() => calcLifeScore(state), [state])
  const preferences = state.settings?.preferences || {}
  const profile = state.settings?.profile || {}

  const todayExpenses = (state.finance?.expenses || []).filter(e => e.date === today)
  const todaySpend = todayExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)
  const dailyBudget = Math.round((preferences.monthlyBudget || 8000) / 30)

  const todaySessions = (state.study?.sessions || []).filter(s => s.date === today)
  const studyMins = todaySessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
  const studyGoalMins = (preferences.dailyStudyGoal || 6) * 60

  const todayTimeEntries = (state.timeflow?.entries || []).filter(e => e.date === today)
  const wasteMins = todayTimeEntries
    .filter(e => e.isWaste)
    .reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0)

  const todayLogs = (state.habits?.dailyLogs || []).filter(l => l.date === today)
  const latestHealth = state.health?.manualLogs?.[0] || {}
  const checkpoints = (state.habits?.checkpoints || []).filter(c => c.isActive)

  const getCheckpointStatus = cpId =>
    todayLogs.find(l => l.checkpointId === cpId)?.status || null

  function toggleCheckpoint(cpId) {
    const existing = todayLogs.find(l => l.checkpointId === cpId)
    const allLogs = state.habits?.dailyLogs || []

    const newLogs = existing
      ? allLogs.map(l =>
          l.checkpointId === cpId && l.date === today
            ? { ...l, status: l.status === 'done' ? null : 'done' }
            : l
        )
      : [
          ...allLogs,
          {
          id: uuid(),
            checkpointId: cpId,
            date: today,
            status: 'done',
            value: null,
            note: '',
            loggedAt: new Date().toISOString(),
          },
        ]

    setModule('habits', { ...state.habits, dailyLogs: newLogs })
  }

  function getStreak(cpId) {
    let streak = 0

    const logs = (state.habits?.dailyLogs || [])
      .filter(l => l.checkpointId === cpId)
      .sort((a, b) => b.date.localeCompare(a.date))

    for (const log of logs) {
      if (log.status === 'done') streak++
      else break
    }

    return streak
  }

  const bestStreak = useMemo(
    () => Math.max(0, ...checkpoints.map(c => getStreak(c.id))),
    [checkpoints, state.habits?.dailyLogs]
  )

  const completedToday = todayLogs.filter(l => l.status === 'done').length
  const completionPct =
    checkpoints.length > 0 ? Math.round((completedToday / checkpoints.length) * 100) : 0

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙'

  const displayName = profile.name || user?.name?.split(' ')[0] || 'Ravish'

  const fabActions = [
    { icon: '💸', label: 'Add Expense', action: () => navigate('/finance') },
    { icon: '⏱️', label: 'Log Time', action: () => navigate('/timeflow') },
    { icon: '✅', label: 'Checkpoint', action: () => navigate('/habits') },
    { icon: '📚', label: 'Study Session', action: () => navigate('/study') },
    { icon: '📝', label: 'Journal', action: () => navigate('/journal') },
  ]

  const scoreBreakdown = [
    { label: 'Habits', val: scores.checkpointScore, color: '#7C82FF' },
    { label: 'Study', val: scores.studyScore, color: '#58A6FF' },
    { label: 'Finance', val: scores.financeScore, color: '#35D39A' },
    { label: 'Waste', val: scores.wasteScore, color: '#F4B740' },
  ]

  const metrics = useMemo(
    () => [
      {
        icon: '💸',
        label: 'Spent Today',
        value: formatCurrencyAmount(todaySpend, currency),
        sub: `${formatCurrencyAmount(dailyBudget, currency)} daily budget`,
        color: todaySpend > dailyBudget ? '#FB7185' : '#34D399',
        to: '/finance',
      },
      {
        icon: '📚',
        label: 'Study Time',
        value: `${(studyMins / 60).toFixed(1)}h`,
        sub: `${(studyGoalMins / 60).toFixed(1)}h goal`,
        color: '#60A5FA',
        to: '/study',
      },
      {
        icon: '📱',
        label: 'Waste Time',
        value: `${(wasteMins / 60).toFixed(1)}h`,
        sub: `${preferences.dailyWasteLimit || 2}h limit`,
        color:
          wasteMins > (preferences.dailyWasteLimit || 2) * 60 ? '#FB7185' : '#34D399',
        to: '/timeflow',
      },
      {
        icon: '🏃',
        label: 'Steps',
        value: (latestHealth.steps || 0).toLocaleString(),
        sub: `${(preferences.dailyStepGoal || 10000).toLocaleString()} goal`,
        color: '#F472B6',
        to: '/health',
      },
      {
        icon: '🔥',
        label: 'Best Streak',
        value: `${bestStreak} days`,
        sub: 'longest active run',
        color: '#F59E0B',
        to: '/habits',
      },
      {
        icon: '😴',
        label: 'Sleep',
        value: `${(Number(latestHealth.sleepHours) || 0).toFixed(1)}h`,
        sub: 'last night',
        color: '#A78BFA',
        to: '/health',
      },
    ],
    [
      todaySpend,
      dailyBudget,
      studyMins,
      studyGoalMins,
      wasteMins,
      preferences.dailyWasteLimit,
      preferences.dailyStepGoal,
      latestHealth.steps,
      latestHealth.sleepHours,
      bestStreak,
      currency,
    ]
  )

  return (
    <div style={{ padding: '0 0 24px', maxWidth: '1120px', margin: '0 auto' }}>
      <div style={{ padding: '28px 24px 12px' }}>
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '28px',
            padding: isCompactHero ? '22px' : '28px',
            display: 'grid',
            gridTemplateColumns: isCompactHero ? '1fr' : 'minmax(0, 1.45fr) minmax(250px, 320px)',
            gap: '24px',
            alignItems: 'center',
            background:
              'radial-gradient(circle at top left, rgba(99,102,241,0.16), transparent 30%), rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.14)',
            boxShadow: '0 18px 60px rgba(2,6,23,0.28)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 35%, transparent 65%, rgba(99,102,241,0.05))',
            }}
          />

          <div style={{ position: 'relative', minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 12px',
                borderRadius: '999px',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(129,140,248,0.18)',
                color: '#B9C2FF',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                marginBottom: '16px',
              }}
            >
              <Sparkles size={14} />
              Daily Overview
            </div>

            <h1
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 3.25rem)',
                lineHeight: 1.02,
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.04em',
                maxWidth: '12ch',
              }}
            >
              {greeting}, {displayName} {greetEmoji}
            </h1>

            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '14px',
                marginTop: '10px',
              }}
            >
              {format(new Date(), 'EEEE, d MMMM yyyy')}
            </p>

            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                lineHeight: 1.7,
                marginTop: '16px',
                maxWidth: '58ch',
              }}
            >
              A clean snapshot of your momentum today — study, spending, habits, health,
              and focus in one place.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '18px',
              }}
            >
              <button
                onClick={() => navigate('/habits')}
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(129,140,248,0.2)',
                  background: 'rgba(99,102,241,0.16)',
                  color: '#E5E7EB',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                Open habits
              </button>

              <button
                onClick={() => navigate('/analytics')}
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                View analytics
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: isCompactHero ? '6px 0 0' : '6px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '280px',
                borderRadius: '24px',
                padding: '18px 16px 14px',
                background: 'rgba(15,23,42,0.36)',
                border: '1px solid rgba(148,163,184,0.12)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                Your score today
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ScoreRing score={scores.total} size={170} label="Life Score" />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                {scoreBreakdown.map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                        color,
                      }}
                    >
                      {val}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div style={{ padding: '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
          }}
        >
          {metrics.map(({ icon, label, value, sub, color, to }) => (
            <Card
              key={label}
              onClick={() => navigate(to)}
              style={{
                padding: '18px',
                cursor: 'pointer',
                borderRadius: '18px',
                background: 'rgba(15,23,42,0.48)',
                border: '1px solid rgba(148,163,184,0.10)',
                boxShadow: '0 10px 30px rgba(2,6,23,0.16)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '22px' }}>{icon}</div>
                <ArrowRight size={16} color="var(--text-muted)" />
              </div>

              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono, monospace',
                  color,
                  marginTop: '16px',
                }}
              >
                {value}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                {label}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                {sub}
              </div>
            </Card>
          ))}
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isCompactHero ? '1fr' : 'minmax(0, 1.25fr) minmax(280px, 0.75fr)',
            gap: '18px',
          }}
        >
          <Card
            style={{
              padding: '18px',
              borderRadius: '20px',
              background: 'rgba(15,23,42,0.52)',
              border: '1px solid rgba(148,163,184,0.10)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '18px',
                    margin: 0,
                  }}
                >
                  Today&apos;s Checkpoints
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Finish your essentials and keep the streak alive.
                </p>
              </div>

              <div
                style={{
                  minWidth: '84px',
                  textAlign: 'right',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#C7D2FE',
                  }}
                >
                  {completedToday} / {checkpoints.length}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {completionPct}% done
                </div>
              </div>
            </div>

            <div
              style={{
                height: '8px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: `${completionPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                  borderRadius: '999px',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {checkpoints.length === 0 ? (
                <div
                  style={{
                    padding: '16px 14px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(148,163,184,0.10)',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                  }}
                >
                  No active checkpoints yet.
                </div>
              ) : (
                checkpoints.slice(0, 5).map(cp => {
                  const status = getCheckpointStatus(cp.id)
                  const streak = getStreak(cp.id)
                  const done = status === 'done'

                  return (
                    <button
                      key={cp.id}
                      onClick={() => toggleCheckpoint(cp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: done ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${done ? 'rgba(16,185,129,0.22)' : 'rgba(148,163,184,0.10)'}`,
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '999px',
                          border: `2px solid ${done ? '#10B981' : 'rgba(148,163,184,0.55)'}`,
                          background: done ? '#10B981' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {done && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
                      </div>

                      <span style={{ fontSize: '19px', flexShrink: 0 }}>{cp.icon}</span>

                      <span
                        style={{
                          flex: 1,
                          fontSize: '14px',
                          fontWeight: 600,
                          color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {cp.title}
                      </span>

                      {streak > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#F59E0B',
                            fontWeight: 700,
                          }}
                        >
                          🔥 {streak}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            <button
              onClick={() => navigate('/habits')}
              style={{
                marginTop: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#A5B4FC',
                fontWeight: 700,
              }}
            >
              See all checkpoints <ArrowRight size={14} />
            </button>
          </Card>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <Card
              style={{
                padding: '18px',
                borderRadius: '20px',
                background: 'rgba(15,23,42,0.52)',
                border: '1px solid rgba(148,163,184,0.10)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '12px',
                    background: 'rgba(99,102,241,0.14)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Zap size={16} color="#A5B4FC" />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: '16px',
                    }}
                  >
                    Today&apos;s Insight
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    AI-style summary based on your logs
                  </div>
                </div>
              </div>

              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {studyMins < 60
                  ? `You haven't logged much study time today yet. A short focused session right now would improve your momentum more than trying to catch up late at night.`
                  : `You've studied ${(studyMins / 60).toFixed(1)} hours today. ${
                      wasteMins > 60
                        ? `Your main drag is ${(wasteMins / 60).toFixed(1)}h of waste time, so reducing distractions will improve your total score fast.`
                        : `Your focus looks solid today — keep this rhythm and close the day with one more clean win.`
                    }`}
              </p>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '12px 0 0' }}>
                Add Gemini API key in Settings for deeper personalized insights.
              </p>
            </Card>

            <Card
              style={{
                padding: '18px',
                borderRadius: '20px',
                background: 'rgba(15,23,42,0.52)',
                border: '1px solid rgba(148,163,184,0.10)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(148,163,184,0.08)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Focus score</div>
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '20px',
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#60A5FA',
                    }}
                  >
                    {scores.studyScore}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(148,163,184,0.08)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Habit score</div>
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '20px',
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#818CF8',
                    }}
                  >
                    {scores.checkpointScore}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        {fabOpen &&
          fabActions.map(({ icon, label, action }) => (
            <button
              key={label}
              onClick={() => {
                action()
                setFabOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(15,23,42,0.88)',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: '14px',
                padding: '11px 16px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                boxShadow: '0 10px 30px rgba(2,6,23,0.35)',
                animation: 'fadeInUp 0.18s ease',
              }}
            >
              <span style={{ fontSize: '18px' }}>{icon}</span>
              {label}
            </button>
          ))}

        <button
          onClick={() => setFabOpen(o => !o)}
          aria-label="Quick add"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px rgba(99,102,241,0.45)',
            transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.22s ease',
          }}
        >
          <Plus size={24} color="#fff" />
        </button>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
