import { useState, useMemo, useEffect } from 'react'
import { useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { playSuccessSound, playSubtleClick, playNoticeChime } from '../hooks/useAudio'
import { hapticSuccess, hapticMedium, hapticLight } from '../hooks/useHaptic'
import { Sparkles, Trophy, Calendar, DollarSign, Clock, Brain, Heart, Award, ArrowLeft, ArrowRight, RefreshCw, BarChart2 } from 'lucide-react'

export default function YearInReview() {
  const state = useAppState()
  const [currentSlide, setCurrentSlide] = useState(0)

  // Extract Stats
  const stats = useMemo(() => {
    // 1. Study Tracker Analytics
    const studySessions = state.study?.sessions || []
    const totalStudyMins = studySessions.reduce((acc, s) => acc + (Number(s.durationMinutes) || 0), 0)
    const totalStudyHours = parseFloat((totalStudyMins / 60).toFixed(1))
    
    // Top Subject
    const subjectMap = {}
    studySessions.forEach(s => {
      subjectMap[s.subject] = (subjectMap[s.subject] || 0) + (Number(s.durationMinutes) || 0)
    })
    let topSubject = 'None'
    let topSubjectMins = 0
    Object.entries(subjectMap).forEach(([subject, mins]) => {
      if (mins > topSubjectMins) {
        topSubject = subject
        topSubjectMins = mins
      }
    })
    const topSubjectHours = parseFloat((topSubjectMins / 60).toFixed(1))

    // 2. Finance Tracker Analytics
    const expenses = state.finance?.expenses || []
    const totalSpent = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
    
    const categoryMap = {}
    expenses.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + (Number(e.amount) || 0)
    })
    let topCategory = 'None'
    let topCategoryAmt = 0
    Object.entries(categoryMap).forEach(([cat, amt]) => {
      if (amt > topCategoryAmt) {
        topCategory = cat
        topCategoryAmt = amt
      }
    })

    // 3. Habits & Streaks
    const checkpoints = state.habits?.checkpoints || []
    const longestStreak = checkpoints.reduce((max, c) => Math.max(max, Number(c.streak || 0)), 0)
    const activeHabitsCount = checkpoints.length

    // 4. Health & Sleep
    const bodyLogs = state.health?.bodyLogs || []
    const totalSteps = bodyLogs.reduce((acc, l) => acc + (Number(l.steps) || 0), 0)
    const sleepLogs = bodyLogs.filter(l => l.sleepHours)
    const avgSleep = sleepLogs.length
      ? parseFloat((sleepLogs.reduce((acc, l) => acc + Number(l.sleepHours), 0) / sleepLogs.length).toFixed(1))
      : 7.2

    // 5. Journal Sentiment
    const journalEntries = state.journal?.entries || []
    const avgMood = journalEntries.length
      ? parseFloat((journalEntries.reduce((acc, e) => acc + (Number(e.mood) || 3), 0) / journalEntries.length).toFixed(1))
      : 4.1

    // 6. Meditation
    const meditationSessions = state.meditations?.sessions || []
    const totalMeditationMins = meditationSessions.reduce((acc, s) => acc + (Number(s.minutes) || 0), 0)

    // Calculate Grade Title
    let grade = 'B-Tier Habit Scholar'
    let gradeDesc = 'Solid consistency! You are building healthy tracking habits.'
    const totalPoints = (totalStudyHours * 2) + (longestStreak * 5) + (totalMeditationMins) + (totalSteps / 10000)
    if (totalPoints > 400) {
      grade = '👑 S-Tier Life Optimizer'
      gradeDesc = 'Absolute legendary performance! You have mastered the discipline required to align your daily actions with your ultimate goals.'
    } else if (totalPoints > 200) {
      grade = '⚡ A-Tier Productivity Hero'
      gradeDesc = 'Incredible achievement! You are crushing your studies and maintaining excellent habit consistency.'
    } else if (totalPoints > 100) {
      grade = '🌟 A-Tier discipline Apprentice'
      gradeDesc = 'Great progress! You are actively tracking and laying down the groundwork for high performance.'
    }

    return {
      totalStudyHours,
      topSubject,
      topSubjectHours,
      totalSpent,
      topCategory,
      topCategoryAmt,
      longestStreak,
      activeHabitsCount,
      totalSteps,
      avgSleep,
      avgMood,
      totalMeditationMins,
      grade,
      gradeDesc
    }
  }, [state])

  // Play chimes on slide change
  useEffect(() => {
    playNoticeChime()
    hapticMedium()
  }, [currentSlide])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlide])

  const totalSlides = 6

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(c => c + 1)
    } else {
      // Loop back to start
      setCurrentSlide(0)
      playSuccessSound()
      hapticSuccess()
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(c => c - 1)
    }
  }

  // Slide content renderers
  const renderSlide = () => {
    switch (currentSlide) {
      case 0:
        return (
          <div style={slideContentStyle('linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)')}>
            <div style={{ fontSize: '72px', animation: 'float 3s ease-in-out infinite' }}>🚀</div>
            <h1 style={titleStyle}>Life OS Wrapped</h1>
            <p style={subtitleStyle}>Your year in review, summarized into a premium presentation of statistics and achievements.</p>
            <div style={badgeStyle}>Press → or Click Next to start</div>
          </div>
        )
      case 1:
        return (
          <div style={slideContentStyle('linear-gradient(135deg, #1E1B4B 0%, #311042 100%)')}>
            <Clock size={48} color="#A78BFA" style={{ marginBottom: '16px' }} />
            <h2 style={sectionTitleStyle}>Focus & Deep Study</h2>
            <div style={giantNumberStyle}>{stats.totalStudyHours} hrs</div>
            <p style={labelStyle}>Total time dedicated to study modules</p>

            <div style={cardGridStyle}>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Top Subject Focus</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-indigo)' }}>{stats.topSubject}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats.topSubjectHours} hours logged</div>
              </Card>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Spaced Repetition</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-pink)' }}>Anki Deck Review</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Continuous retention loops</div>
              </Card>
            </div>
          </div>
        )
      case 2:
        return (
          <div style={slideContentStyle('linear-gradient(135deg, #064E3B 0%, #111827 100%)')}>
            <Trophy size={48} color="#34D399" style={{ marginBottom: '16px' }} />
            <h2 style={sectionTitleStyle}>Discipline & Habits</h2>
            <div style={giantNumberStyle}>{stats.longestStreak} Days</div>
            <p style={labelStyle}>Your longest habit streak of the year</p>

            <div style={cardGridStyle}>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Routines</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#10B981' }}>{stats.activeHabitsCount} Habits</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configured in Scoring system</div>
              </Card>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Streak Protection</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#FBBF24' }}>RPG Shields Active</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Streak defenses fortified</div>
              </Card>
            </div>
          </div>
        )
      case 3:
        return (
          <div style={slideContentStyle('linear-gradient(135deg, #0F172A 0%, #1E293B 100%)')}>
            <DollarSign size={48} color="#FBBF24" style={{ marginBottom: '16px' }} />
            <h2 style={sectionTitleStyle}>Financial Balance</h2>
            <div style={giantNumberStyle}>₹{stats.totalSpent.toLocaleString('en-IN')}</div>
            <p style={labelStyle}>Total transactional expenses parsed and logged</p>

            <div style={cardGridStyle}>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Top Expense Sector</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#FBBF24' }}>{stats.topCategory}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>₹{stats.topCategoryAmt.toLocaleString('en-IN')} spent</div>
              </Card>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Import Mode</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#60A5FA' }}>UPI SMS Auto Import</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verified transaction cards</div>
              </Card>
            </div>
          </div>
        )
      case 4:
        return (
          <div style={slideContentStyle('linear-gradient(135deg, #172554 0%, #1E1B4B 100%)')}>
            <Heart size={48} color="#F43F5E" style={{ marginBottom: '16px' }} />
            <h2 style={sectionTitleStyle}>Mindfulness & Health</h2>
            <div style={giantNumberStyle}>{stats.totalSteps.toLocaleString()} steps</div>
            <p style={labelStyle}>Total active body steps tracked</p>

            <div style={cardGridStyle}>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sleep & Meditation</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#38BDF8' }}>{stats.avgSleep}h Sleep / {stats.totalMeditationMins}m Med</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Deep & REM Stage analysis active</div>
              </Card>
              <Card style={wrappedCardStyle}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Emotional Index</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#F43F5E' }}>{stats.avgMood} / 5.0 Mood</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI sentiment loops logs</div>
              </Card>
            </div>
          </div>
        )
      case 5:
        return (
          <div style={slideContentStyle('linear-gradient(135deg, #581C87 0%, #1E1B4B 100%)')}>
            <Award size={64} color="#FCD34D" style={{ marginBottom: '16px', animation: 'spin 12s linear infinite' }} />
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '24px', color: 'white', textAlign: 'center', marginBottom: '8px' }}>Your Life Class Status</h2>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#FCD34D', textAlign: 'center', textShadow: '0 4px 12px rgba(0,0,0,0.3)', marginBottom: '14px' }}>
              {stats.grade}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '480px', lineHeight: '1.6', marginBottom: '24px' }}>
              {stats.gradeDesc}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={() => setCurrentSlide(0)} variant="secondary">
                <RefreshCw size={14} /> Restart Slideshow
              </Button>
              <Button onClick={() => playSuccessSound()}>
                Share Achievement 🔗
              </Button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  // Common styles
  const slideContentStyle = (bg) => ({
    background: bg,
    width: '100%',
    minHeight: '440px',
    borderRadius: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    color: '#white',
    boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
    transition: 'all 0.5s ease',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  })

  const titleStyle = {
    fontFamily: 'Syne, sans-serif',
    fontWeight: '900',
    fontSize: '2.8rem',
    textAlign: 'center',
    margin: '16px 0 8px',
    background: 'linear-gradient(90deg, #FFFFFF 0%, #FFE4E6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 4px 12px rgba(0,0,0,0.15)',
  }

  const subtitleStyle = {
    fontSize: '14px',
    textAlign: 'center',
    color: '#E0E7FF',
    maxWidth: '440px',
    lineHeight: '1.6',
    marginBottom: '20px',
  }

  const badgeStyle = {
    fontSize: '10px',
    fontWeight: '800',
    color: '#FFE4E6',
    background: 'rgba(255, 255, 255, 0.12)',
    padding: '6px 12px',
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }

  const sectionTitleStyle = {
    fontFamily: 'Syne, sans-serif',
    fontWeight: '800',
    fontSize: '22px',
    color: 'white',
    margin: '0 0 4px',
  }

  const giantNumberStyle = {
    fontFamily: 'Syne, sans-serif',
    fontWeight: '950',
    fontSize: '4.2rem',
    color: '#FFE4E6',
    margin: '8px 0',
    textShadow: '0 4px 20px rgba(255, 228, 230, 0.25)',
  }

  const labelStyle = {
    fontSize: '13px',
    color: '#C7D2FE',
    marginBottom: '24px',
    textAlign: 'center',
  }

  const cardGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    width: '100%',
    maxWidth: '420px',
  }

  const wrappedCardStyle = {
    padding: '12px',
    textAlign: 'center',
    background: 'rgba(15, 23, 42, 0.42)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '48px' }}>
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
      
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🎉 Spotify Wrapped for Life</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Look back at your statistics, achievements, focus hours, and wellness records.
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Slide Display Area */}
        {renderSlide()}

        {/* Action Controls Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <Button variant="secondary" onClick={handlePrev} disabled={currentSlide === 0}>
            <ArrowLeft size={16} /> Prev
          </Button>

          {/* Dots Indicator */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div
                key={i}
                onClick={() => { playSubtleClick(); setCurrentSlide(i); }}
                style={{
                  width: currentSlide === i ? '20px' : '8px',
                  height: '8px',
                  borderRadius: '99px',
                  background: currentSlide === i ? 'var(--accent-indigo)' : 'var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
              />
            ))}
          </div>

          <Button onClick={handleNext}>
            {currentSlide === totalSlides - 1 ? 'Wrap Up ✓' : 'Next'} <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
