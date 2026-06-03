import { useMemo } from 'react'
import { useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import XPBar from '../components/ui/XPBar'
import { calculateXP, getLevel } from '../utils/gamification'
import { getTodayDateKey } from '../utils/dateTime'
import { Shield, Sparkles, Sword, Zap, Brain, Trophy, Coins } from 'lucide-react'

const LEVEL_TITLES = {
  1: 'Beginner', 2: 'Novice', 3: 'Apprentice', 4: 'Explorer',
  5: 'Achiever', 6: 'Challenger', 7: 'Specialist', 8: 'Veteran',
  9: 'Expert', 10: 'Master', 11: 'Champion', 12: 'Legend',
  13: 'Elite', 14: 'Titan', 15: 'Virtuoso', 16: 'Sage',
  17: 'Overlord', 18: 'Paragon', 19: 'Ascendant', 20: 'Mythic',
  21: 'Immortal', 22: 'Transcendent', 23: 'Celestial', 24: 'Divine',
  25: 'Absolute', 26: 'MAX',
}

const GEAR_BY_LEVEL = [
  { lv: 1,  weapon: '📝 Wooden Pencil', armor: '👕 Cotton Hoodie', trinket: '🥤 Tap Water' },
  { lv: 3,  weapon: '🖊️ Steel Ballpoint', armor: '🧥 Bomber Jacket', trinket: '☕ Black Coffee' },
  { lv: 6,  weapon: '✒️ Fountain Pen', armor: '🧥 Techwear Windbreaker', trinket: '🍵 Matcha Latte' },
  { lv: 10, weapon: '⌨️ Mechanical Keyboard', armor: '🥋 Indigo Blazer', trinket: '🧉 Yerba Mate' },
  { lv: 15, weapon: '💻 Ultra Laptop', armor: '🧥 Nanotech Suit', trinket: '🧠 Nootropic Stack' },
  { lv: 20, weapon: '⚡ Neural Implant', armor: '✨ Holographic Cloak', trinket: '🌌 Cosmic Elixir' },
]

export default function RPG() {
  const state = useAppState()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const xp = useMemo(() => calculateXP(state), [state])
  const level = useMemo(() => getLevel(xp), [xp])
  const title = LEVEL_TITLES[level] || 'Absolute'

  // Calculate Equipped Gear based on current level
  const equippedGear = useMemo(() => {
    let active = GEAR_BY_LEVEL[0]
    for (const gear of GEAR_BY_LEVEL) {
      if (level >= gear.lv) active = gear
    }
    return active
  }, [level])

  // RPG Attributes derived from real tracking logs:
  const stats = useMemo(() => {
    // 1. STR (Strength) - Walked Steps (from bodyLogs)
    const bodyLogs = state.health?.bodyLogs || []
    const totalSteps = bodyLogs.reduce((sum, log) => sum + (Number(log.steps) || 0), 0)
    const str = Math.min(100, Math.max(10, Math.floor(totalSteps / 10000) + 10))

    // 2. INT (Intelligence) - Study Duration (from study sessions)
    const sessions = state.study?.sessions || []
    const totalStudyHours = sessions.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0) / 60
    const intel = Math.min(100, Math.max(10, Math.floor(totalStudyHours * 1.5) + 10))

    // 3. WTH (Wealth) - Budget Control performance (from finance)
    const expenses = state.finance?.expenses || []
    const monthlyBudget = state.settings?.preferences?.monthlyBudget || 15000
    const dailyBudget = monthlyBudget / 30
    const underBudgetDays = expenses.reduce((days, exp) => {
      // Find days under daily budget
      const date = exp.date
      if (!date) return days
      return days
    }, 0)
    const wth = Math.min(100, Math.max(10, 80 - Math.min(50, expenses.length * 0.5) + (underBudgetDays * 2)))

    // 4. SPR (Spirit) - Sleep Hours + Journal Entries
    const journalEntries = state.journal?.entries || []
    const sleepLogs = bodyLogs.filter(l => l.sleepHours)
    const avgSleep = sleepLogs.length ? (sleepLogs.reduce((a, l) => a + Number(l.sleepHours), 0) / sleepLogs.length) : 7
    const spr = Math.min(100, Math.max(10, (journalEntries.length * 3) + Math.round(avgSleep * 5)))

    // 5. PRD (Productivity) - Timeflow logged entries and productive hours
    const timeflowEntries = state.timeflow?.entries || []
    const productiveHrs = timeflowEntries.filter(e => !e.isWaste).reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0) / 60
    const prd = Math.min(100, Math.max(10, Math.floor(productiveHrs * 2) + 10))

    return { str, int: intel, wth, spr, prd }
  }, [state])

  // Interactive Daily Quests:
  const quests = useMemo(() => {
    const preferences = state.settings?.preferences || {}
    
    // Check habits logged today
    const todayLogs = (state.habits?.dailyLogs || []).filter(l => l.date === today)
    const completedHabits = todayLogs.filter(l => l.status === 'done').length
    
    // Check study logged today
    const todayStudy = (state.study?.sessions || []).filter(s => s.date === today)
    const studyHoursToday = todayStudy.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0) / 60

    // Check steps logged today
    const todayBodyLog = (state.health?.bodyLogs || []).find(l => l.date === today) || {}
    const stepsToday = todayBodyLog.steps || 0

    // Check finance logged today
    const todayExpenses = (state.finance?.expenses || []).filter(e => e.date === today)
    const todaySpend = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const dailyBudget = Math.round((preferences.monthlyBudget || 15000) / 30)

    // Check journal logged today
    const todayJournalEntry = (state.journal?.entries || []).some(j => j.date === today)

    return [
      {
        id: 'q_steps',
        title: 'Active Nomad',
        desc: 'Walk 8,000 steps today',
        progress: `${stepsToday.toLocaleString()} / 8,000`,
        isDone: stepsToday >= 8000,
        xp: 50,
      },
      {
        id: 'q_study',
        title: 'Library Hermit',
        desc: 'Log at least 1 hour of study time today',
        progress: `${studyHoursToday.toFixed(1)}h / 1.0h`,
        isDone: studyHoursToday >= 1.0,
        xp: 60,
      },
      {
        id: 'q_finance',
        title: 'Thrifty Sage',
        desc: `Stay under today's budget limit`,
        progress: `Spend: ₹${todaySpend} / Limit: ₹${dailyBudget}`,
        isDone: todaySpend <= dailyBudget,
        xp: 40,
      },
      {
        id: 'q_habits',
        title: 'Discipline Master',
        desc: 'Complete at least 2 habits today',
        progress: `${completedHabits} / 2 completed`,
        isDone: completedHabits >= 2,
        xp: 50,
      },
      {
        id: 'q_journal',
        title: 'Self Reflector',
        desc: 'Write today\'s journal entry',
        progress: todayJournalEntry ? 'Completed' : 'Pending',
        isDone: todayJournalEntry,
        xp: 40,
      },
    ]
  }, [state, today])

  // Custom Radar Polygon coordinates calculator
  const radarPolygonPoints = useMemo(() => {
    const values = [stats.str, stats.int, stats.wth, stats.spr, stats.prd]
    const angles = [0, 72, 144, 216, 288]
    const centerX = 120
    const centerY = 120
    const radius = 80

    return angles.map((angle, idx) => {
      const val = values[idx]
      const radians = (angle * Math.PI) / 180 - Math.PI / 2
      const x = centerX + radius * (val / 100) * Math.cos(radians)
      const y = centerY + radius * (val / 100) * Math.sin(radians)
      return `${x},${y}`
    }).join(' ')
  }, [stats])

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '32px' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🏆 Life RPG</h1>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Level up your real life. Track stats, clear quests, and equip mythical productivity gear.
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Character Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '48px', width: '72px', height: '72px', borderRadius: '18px', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.22)', display: 'grid', placeItems: 'center' }}>
                🛡️
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  Level {level} {title}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Rank status: Accomplished Lifelogger
                </div>
              </div>
            </div>

            <XPBar />

            {/* Equipped gear slot dashboard */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                🛡️ Current Equipped Gear
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Weapon Slot:</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{equippedGear.weapon}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Armor Slot:</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{equippedGear.armor}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Trinket Slot:</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{equippedGear.trinket}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Attributes Radar Web */}
          <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '14px', alignSelf: 'flex-start' }}>
              📊 Stats Web (Radar Chart)
            </h3>

            {/* Interactive SVG Radar Web */}
            <svg width="240" height="240" viewBox="0 0 240 240" style={{ overflow: 'visible' }}>
              {/* Web Grid outlines */}
              {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => {
                const r = 80 * scale
                const pts = [0, 72, 144, 216, 288].map(angle => {
                  const radians = (angle * Math.PI) / 180 - Math.PI / 2
                  return `${120 + r * Math.cos(radians)},${120 + r * Math.sin(radians)}`
                }).join(' ')
                return (
                  <polygon
                    key={i}
                    points={pts}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="1"
                    strokeDasharray={scale === 1 ? 'none' : '2 3'}
                  />
                )
              })}

              {/* Angle axis lines */}
              {[0, 72, 144, 216, 288].map((angle, i) => {
                const radians = (angle * Math.PI) / 180 - Math.PI / 2
                return (
                  <line
                    key={i}
                    x1="120"
                    y1="120"
                    x2={120 + 80 * Math.cos(radians)}
                    y2={120 + 80 * Math.sin(radians)}
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                )
              })}

              {/* Data polygon */}
              <polygon
                points={radarPolygonPoints}
                fill="rgba(236,72,153,0.18)"
                stroke="var(--accent-indigo)"
                strokeWidth="2.5"
                style={{ transition: 'all 0.5s ease-in-out' }}
              />

              {/* Vertex data dots & Label texts */}
              {[
                { name: `STR (${stats.str})`, angle: 0 },
                { name: `INT (${stats.int})`, angle: 72 },
                { name: `WTH (${stats.wth})`, angle: 144 },
                { name: `SPR (${stats.spr})`, angle: 216 },
                { name: `PRD (${stats.prd})`, angle: 288 },
              ].map(({ name, angle }, idx) => {
                const radians = (angle * Math.PI) / 180 - Math.PI / 2
                const values = [stats.str, stats.int, stats.wth, stats.spr, stats.prd]
                const val = values[idx]
                const dotX = 120 + 80 * (val / 100) * Math.cos(radians)
                const dotY = 120 + 80 * (val / 100) * Math.sin(radians)
                const labelX = 120 + 96 * Math.cos(radians)
                const labelY = 120 + 94 * Math.sin(radians)

                return (
                  <g key={idx}>
                    <circle
                      cx={dotX}
                      cy={dotY}
                      r="4.5"
                      fill="#EC4899"
                      stroke="#fff"
                      strokeWidth="1"
                      style={{ transition: 'all 0.5s ease-in-out' }}
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{
                        fill: 'var(--text-secondary)',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: '700',
                      }}
                    >
                      {name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </Card>

        </div>

        {/* Daily Quests Board */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', fontFamily: 'Syne, sans-serif', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚔️ Active Daily Quests
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reset at Midnight</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {quests.map(q => (
              <div
                key={q.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: q.isDone ? 'rgba(16,185,129,0.06)' : 'var(--bg-secondary)',
                  border: `1px solid ${q.isDone ? 'rgba(16,185,129,0.22)' : 'var(--border)'}`,
                  opacity: q.isDone ? 0.9 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Done Check Icon or Quest Target Indicator */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: q.isDone ? '#10B981' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${q.isDone ? '#10B981' : 'var(--border)'}`,
                  color: q.isDone ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}>
                  {q.isDone ? '✓' : idxToQuestsNum(q.id)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: q.isDone ? '#10B981' : 'var(--text-primary)', textDecoration: q.isDone ? 'line-through' : 'none' }}>
                    {q.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {q.desc} • <span style={{ color: 'var(--text-secondary)' }}>{q.progress}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
                    +{q.xp} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function idxToQuestsNum(id) {
  switch (id) {
    case 'q_steps': return '1'
    case 'q_study': return '2'
    case 'q_finance': return '3'
    case 'q_habits': return '4'
    case 'q_journal': return '5'
    default: return '?'
  }
}
