import { useMemo, useState, useCallback } from 'react'
import { AnimatePresence } from 'motion/react'
import { CalendarDays, Edit3, Check, AlertTriangle, Clock, Sparkles, ArrowRight, ChevronDown } from 'lucide-react'
import { Page, Card, StatCard, Tabs, Button, Sheet, EmptyState, Ring, Chips, Confetti, Status } from '../ui/index'
import DateNavigator from '../ui/calendar/DateNavigator'
import HeatCalendar from '../ui/calendar/HeatCalendar'
import { heatColor, syncColor } from '../ui/calendar/calendarMath'
import { useLocalPref, useLiveNow } from '../ui/hooks'
import { fmtMinutes, fmtClock, fmtPct, fmtDate, relativeDay } from '../ui/format'
import { localDate, addDays } from '../domain/metrics/dates'
import { parseDiary, scheduleDraft } from '../domain/planning'
import { computeDaySync } from '../domain/planning/sync'
import { useAppState, useAppActions } from '../context/appHooks'
import { useNavigate, useSearchParams } from 'react-router-dom'

const PRIORITY_COLORS = { must: '#F43F5E', should: '#F59E0B', could: '#22D3EE' }

export default function Plan() {
  const state = useAppState()
  const { patchModule } = useAppActions()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const now = useLiveNow(60000)
  const today = localDate(now)
  const [date, setDate] = useState(params.get('date') || today)
  const [view, setView] = useLocalPref('plan_view', 'day')
  const [showCompose, setShowCompose] = useState(false)
  const [diaryText, setDiaryText] = useState('')
  const [confetti, setConfetti] = useState(false)

  const draft = state.planning?.drafts?.[date]
  const approved = draft?.status === 'approved'
  const blocks = draft?.blocks || []

  // Parse diary text
  const parsed = useMemo(() => {
    if (!diaryText.trim()) return null
    try { return parseDiary(diaryText) } catch { return null }
  }, [diaryText])

  // Compute sync for this day
  const sync = useMemo(() => {
    try { return computeDaySync(state, date, { now, timezone: 'Asia/Kolkata', mode: 'live' }) }
    catch { return null }
  }, [state, date, now])

  const views = [
    { key: 'day', label: 'Day' },
    { key: 'compare', label: 'Compare' },
    { key: 'month', label: 'Month' },
  ]

  const handleSaveDraft = useCallback(() => {
    if (!parsed?.length) return
    const scheduled = scheduleDraft(parsed, { localDate: date, timezone: 'Asia/Kolkata' })
    patchModule('planning', { drafts: { ...state.planning?.drafts, [date]: { blocks: scheduled.blocks, unscheduled: scheduled.unscheduled, status: 'draft', createdAt: new Date().toISOString() } } })
    setDiaryText('')
    setShowCompose(false)
  }, [parsed, date, patchModule, state.planning?.drafts])

  const handleApprove = useCallback(async () => {
    if (!draft) return
    patchModule('planning', { drafts: { ...state.planning?.drafts, [date]: { ...draft, status: 'approved', approvedAt: new Date().toISOString() } } })
    setConfetti(true)
    try {
      const { exportApprovedPlan } = await import('../services/calendarService')
      await exportApprovedPlan(draft)
    } catch (err) {
      console.warn('Failed to sync to Google Calendar:', err)
    }
  }, [draft, date, patchModule, state.planning?.drafts])

  return <Page title="Plan" icon={CalendarDays} color="#6366F1"
    actions={<>
      <DateNavigator value={date} onChange={setDate} today={today} max={addDays(today, 7)} />
      <Button variant="primary" icon={Edit3} onClick={() => setShowCompose(true)}>Write plan</Button>
    </>}>

    <Confetti fire={confetti} onDone={() => setConfetti(false)} />

    <Tabs tabs={views} value={view} onChange={setView} id="plan" />

    {/* Sync summary strip */}
    {sync && sync.status !== 'no-plan' && <div className="ui-grid cols-3">
      <StatCard label="Sync" value={sync.timing?.value} format={v => fmtPct(v)} color={syncColor(sync.timing?.value)} icon={Sparkles}
        truth={{ status: sync.timing?.value >= .8 ? 'complete' : sync.timing?.value >= .5 ? 'partial' : 'low',
          rows: [['Timing', fmtPct(sync.timing?.value)], ['Effort', fmtPct(sync.effort?.value)], ['Outcome', fmtPct(sync.outcome?.value)]],
          note: `${sync.details?.filter(d => d.status === 'on-time' || d.status === 'done-untimed').length || 0} of ${sync.details?.length || 0} blocks on track`
        }} />
      <StatCard label="Must" value={sync.must?.completed != null ? sync.must.completed : null} format={v => `${v}/${sync.must?.total || 0}`} color="#F43F5E" />
      <StatCard label="Status" value={null} note={sync.status === 'complete' ? '✓ Day complete' : sync.status === 'partial' ? 'In progress' : 'Not started'} />
    </div>}

    {view === 'day' && <DayView date={date} blocks={blocks} draft={draft} approved={approved} sync={sync} onApprove={handleApprove} navigate={navigate} />}
    {view === 'compare' && <CompareView date={date} sync={sync} blocks={blocks} />}
    {view === 'month' && <MonthView state={state} date={date} setDate={setDate} today={today} now={now} />}

    {/* Diary composer sheet */}
    <Sheet open={showCompose} onClose={() => setShowCompose(false)} title={`Plan for ${relativeDay(date, today)}`}
      footer={<><Button variant="ghost" onClick={() => setShowCompose(false)}>Cancel</Button><Button variant="primary" onClick={handleSaveDraft} disabled={!parsed?.length}>Save draft</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '.82rem', color: 'var(--text-3)' }}>Write what you want to do today in your own words (Hindi/English). LifeOS will parse it into a timeline.</p>
        <textarea className="ui-input" rows={8} value={diaryText} onChange={e => setDiaryText(e.target.value)}
          placeholder={"subah 7 baje uthna\n8-9 study maths\n10 se 12 coding project\nlunch 1 bje\ndopahar gym 1 hour\nshaam reading 2 ghante\nraat 10 bje sona"} style={{ fontFamily: 'var(--font-sans)', lineHeight: 1.6 }} />
        {parsed && <Card eyebrow="Preview" title={`${parsed.length} tasks parsed`}>
          <div className="ui-list">
            {parsed.map((t, i) => <div key={i} className="ui-row">
              <span style={{ width: 8, height: 8, borderRadius: '0', background: PRIORITY_COLORS[t.priority] || '#94A3B8', flexShrink: 0 }} />
              <div className="grow">
                <div className="title">{t.title}</div>
                <div className="meta">
                  {t.startTime && fmtClock(t.startTime)}{t.startTime && t.endTime && ' – '}{t.endTime && fmtClock(t.endTime)}
                  {t.estimateMinutes && ` · ${fmtMinutes(t.estimateMinutes)}`}
                  {t.warning && <span style={{ color: 'var(--warning-ink)' }}> ⚠ {t.warning}</span>}
                </div>
              </div>
              <span style={{ fontSize: '.68rem', fontWeight: 700, color: PRIORITY_COLORS[t.priority] || 'var(--text-3)', textTransform: 'uppercase' }}>{t.priority}</span>
            </div>)}
          </div>
          {parsed.some(t => t.ambiguity) && <Status tone="warn" style={{ marginTop: 12 }}>Some times are ambiguous — review after saving.</Status>}
        </Card>}
      </div>
    </Sheet>
    <div className="pb-24 h-24 min-h-[6rem] mb-12"></div>
    </Page>
}

function DayView({ date, blocks, draft, approved, sync, onApprove, navigate }) {
  if (!draft || blocks.length === 0) {
    return <EmptyState emoji="📝" title="No plan yet" text={`Write what you want to do ${relativeDay(date, localDate()) === 'Today' ? 'today' : 'on ' + fmtDate(date, 'weekday')}`}
      action={<Button variant="primary" icon={Edit3} onClick={() => navigate(`/plan?date=${date}`)}>Write plan</Button>} />
  }

  return <Card>
    {!approved && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Status tone="warn">Draft — review and approve to push to calendar</Status>
      <Button variant="success" icon={Check} onClick={onApprove}>Approve</Button>
    </div>}

    <div className="ui-list">
      {blocks.map((block, i) => {
        const detail = sync?.details?.find(d => d.blockId === block.id)
        const statusColor = detail?.status === 'on-time' ? '#10B981' : detail?.status === 'late' || detail?.status === 'shifted' ? '#F59E0B' : detail?.status === 'skipped' || detail?.status === 'missed' ? '#F43F5E' : 'var(--text-3)'
        return <div key={block.id || i} className="ui-row" style={{ borderLeft: `3px solid ${PRIORITY_COLORS[block.priority] || '#94A3B8'}` }}>
          <div style={{ width: 50, textAlign: 'center', fontSize: '.72rem', fontWeight: 700, color: 'var(--text-3)' }}>
            {block.startTime && fmtClock(block.startTime)}
          </div>
          <div className="grow">
            <div className="title">{block.title}</div>
            <div className="meta">
              {block.estimateMinutes && fmtMinutes(block.estimateMinutes)}
              {detail?.status && <span style={{ color: statusColor, marginLeft: 8 }}>
                {detail.status === 'on-time' ? '✓ On time' : detail.status === 'late' ? '⏱ Late' : detail.status === 'shifted' ? '↪ Shifted' : detail.status === 'skipped' ? '✗ Skipped' : detail.status === 'missed' ? '✗ Missed' : detail.status}
              </span>}
            </div>
          </div>
          <span style={{ fontSize: '.68rem', fontWeight: 700, color: PRIORITY_COLORS[block.priority] || 'var(--text-3)', textTransform: 'uppercase' }}>{block.priority}</span>
        </div>
      })}
    </div>
  </Card>
}

function CompareView({ sync, blocks }) {
  if (!sync || sync.status === 'no-plan') {
    return <EmptyState emoji="🔄" title="Nothing to compare" text="Approve a plan and log some activities to see how your day unfolded vs what you planned." />
  }

  return <>
    {/* Sync ring */}
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center', padding: '1rem 0' }}>
        <Ring value={sync.timing?.value} upper={sync.timing?.upper} size={140} stroke={12} color={syncColor(sync.timing?.value) || 'var(--accent)'}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.4rem' }}>{fmtPct(sync.timing?.value)}</div>
          <div style={{ fontSize: '.68rem', color: 'var(--text-3)' }}>Sync</div>
        </Ring>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><span style={{ fontWeight: 700, color: 'var(--text-3)', fontSize: '.72rem', textTransform: 'uppercase' }}>Timing</span> {fmtPct(sync.timing?.value)}</div>
          <div><span style={{ fontWeight: 700, color: 'var(--text-3)', fontSize: '.72rem', textTransform: 'uppercase' }}>Effort</span> {fmtPct(sync.effort?.value)}</div>
          <div><span style={{ fontWeight: 700, color: 'var(--text-3)', fontSize: '.72rem', textTransform: 'uppercase' }}>Outcome</span> {fmtPct(sync.outcome?.value)}</div>
          {sync.startDelay && <div><span style={{ fontWeight: 700, color: 'var(--text-3)', fontSize: '.72rem', textTransform: 'uppercase' }}>Start delay</span> {fmtMinutes(sync.startDelay.median)}</div>}
        </div>
      </div>
    </Card>

    {/* Dual timeline */}
    {sync.details?.length > 0 && <Card title="Planned vs Actual">
      <div className="ui-list">
        {sync.details.map((d, i) => {
          const block = blocks.find(b => b.id === d.blockId) || {}
          const statusIcon = d.status === 'on-time' ? '✓' : d.status === 'late' || d.status === 'shifted' ? '⏱' : d.status === 'skipped' || d.status === 'missed' ? '✗' : '◐'
          const statusColor = d.status === 'on-time' ? '#10B981' : d.status === 'late' || d.status === 'shifted' ? '#F59E0B' : d.status === 'skipped' || d.status === 'missed' ? '#F43F5E' : 'var(--text-3)'
          return <div key={d.blockId || i} className="ui-row">
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${statusColor} 18%, transparent)`, display: 'grid', placeItems: 'center', color: statusColor, fontWeight: 800, fontSize: '.82rem', flexShrink: 0 }}>{statusIcon}</div>
            <div className="grow">
              <div className="title">{block.title || d.blockId}</div>
              <div className="meta">
                {d.status}{d.derailReason ? ` — ${d.derailReason}` : ''}
                {d.actualSpans?.length > 0 && ` · Actually: ${d.actualSpans.map(s => fmtMinutes(s.minutes)).join(', ')}`}
              </div>
            </div>
            <div className="amt" style={{ color: statusColor }}>{d.blockFit != null ? fmtPct(d.blockFit) : ''}</div>
          </div>
        })}
      </div>
    </Card>}

    {/* Derails */}
    {sync.derails?.length > 0 && <Card title="Derails" eyebrow={`${sync.derails.length} moments`}>
      <div className="ui-list">
        {sync.derails.map((d, i) => <div key={i} className="ui-row" style={{ borderLeft: '3px solid #F43F5E' }}>
          <div className="grow">
            <div className="title">{d.reason || 'Deviation from plan'}</div>
            <div className="meta">{d.planned && `Planned: ${d.planned}`}{d.actual && ` → Actual: ${d.actual}`}</div>
          </div>
        </div>)}
      </div>
    </Card>}
  </>
}

function MonthView({ state, date, setDate, today, now }) {
  const month = date.slice(0, 7)
  const [selected, setSelected] = useState(null)

  const getDay = d => {
    if (d > today) return { status: 'future' }
    const draft = state.planning?.drafts?.[d]
    if (!draft) return { status: 'unknown' }
    let sync
    try { sync = computeDaySync(state, d, { now, timezone: 'Asia/Kolkata', mode: 'final' }) } catch { return { status: 'value', value: '📝' } }
    const v = sync.timing?.value
    return {
      status: 'value', value: v != null ? fmtPct(v) : '📝',
      cellBg: v != null ? heatColor(syncColor(v)?.replace('#', '') || '6366F1', v) : undefined,
      badges: draft.status === 'approved' ? ['✓'] : [],
    }
  }

  return <HeatCalendar month={month} onMonthChange={m => setDate(`${m}-01`)} getDay={getDay}
    selected={selected} onSelect={d => { setSelected(d); setDate(d) }} today={today} maxMonth={today.slice(0, 7)} />
}
