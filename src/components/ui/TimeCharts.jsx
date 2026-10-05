import { useMemo, useState } from 'react'
import { timeMinutes } from '../../utils/planning'
import { categoryColor, formatMinutes } from '../../utils/timeColors'

function toRange(item) {
  const start = timeMinutes(item.start)
  let end = timeMinutes(item.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (end <= start) end = 1440 // overnight logs: show the part that belongs to this day
  return { start, end }
}

const hhmm = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/** Dark tooltip for every Recharts chart in Time Flow. */
export function ChartTooltip({ active, payload, label, unit = 'h', labelFormatter }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter(p => p.value !== undefined && p.value !== null && Number(p.value) !== 0)
  return (
    <div style={{
      background: 'rgba(15,23,42,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 12,
      padding: '10px 12px', boxShadow: '0 12px 30px rgba(0,0,0,0.4)', minWidth: 140, fontSize: 12,
    }}>
      {(label !== undefined && label !== '') && <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{labelFormatter ? labelFormatter(label) : label}</div>}
      {(rows.length ? rows : payload).map(p => (
        <div key={p.dataKey || p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: p.color || p.fill || p.payload?.fill, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
            {unit === 'm' ? formatMinutes(p.value) : `${p.value}${unit}`}
          </strong>
        </div>
      ))}
    </div>
  )
}

/* ─── Hover Tooltip ─── */
import HoverCard from './HoverCard'

function BlockTooltip({ entry, range, x, y, visible }) {
  if (!visible || !entry) return null
  const dur = range.end - range.start
  return (
    <HoverCard point={{ x, y: y || 0 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{entry.name || entry.category}</div>
      <div style={{ color: '#94A3B8' }}>
        {entry.start} – {entry.end} · {formatMinutes(dur)}
      </div>
      {entry.category && <div style={{ color: '#818CF8', fontSize: 11, marginTop: 2 }}>{entry.category}</div>}
    </HoverCard>
  )
}

/**
 * 24-hour ribbon: every logged activity drawn where it happened in the day.
 * Tap / hover a block to see details. Empty space = unlogged time.
 */
export function DayRibbon({ entries = [], height = 48, showAxis = true, compact = false, nowMinute = null, onSelect }) {
  const [selected, setSelected] = useState(null)
  const [hover, setHover] = useState({ visible: false, entry: null, range: null, x: 0, y: 0 })
  const blocks = useMemo(() => entries
    .map(e => ({ entry: e, range: toRange(e) }))
    .filter(b => b.range)
    .sort((a, b) => a.range.start - b.range.start), [entries])

  const pick = (block) => {
    const next = selected?.entry?.id === block.entry.id ? null : block
    setSelected(next)
    onSelect?.(next?.entry || null)
  }

  return (
    <div>
      <div
        role="img"
        aria-label={`Day timeline with ${blocks.length} activities`}
        style={{
          position: 'relative', height, borderRadius: compact ? 6 : 10, overflow: 'visible',
          background: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.06) 0 1px, transparent 1px calc(100% / 24)), rgba(148,163,184,0.05)',
          border: '1px solid rgba(148,163,184,0.10)',
        }}
      >
        {blocks.map(({ entry, range }) => {
          const color = categoryColor(entry.category)
          const left = (range.start / 1440) * 100
          const width = Math.max(((range.end - range.start) / 1440) * 100, 0.4)
          const isSel = selected?.entry?.id === entry.id
          const Block = compact ? 'div' : 'button'
          return (
            <Block
              key={entry.id || `${entry.start}-${entry.name}`}
              {...(compact ? {} : { type: 'button', onClick: () => pick({ entry, range }) })}
              onMouseEnter={e => setHover({ visible: true, entry, range, x: e.clientX, y: e.clientY })}
              onMouseMove={e => setHover(h => ({ ...h, x: e.clientX, y: e.clientY }))}
              onMouseLeave={() => setHover({ visible: false, entry: null, range: null, x: 0, y: 0 })}
              style={{
                position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`,
                minWidth: 0, minHeight: 0, padding: 0, margin: 0,
                background: entry.isWaste ? `repeating-linear-gradient(135deg, ${color} 0 6px, ${color}B0 6px 10px)` : color,
                opacity: selected && !isSel ? 0.45 : 0.92,
                border: 'none', borderRight: '1px solid rgba(15,23,42,0.6)',
                boxShadow: isSel ? `inset 0 0 0 2px #fff` : 'none',
                cursor: compact ? 'inherit' : 'pointer', transition: 'opacity .15s ease',
                overflow: 'hidden', color: '#fff', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}
            >
              {!compact && width > 7 ? (
                <span style={{ display: 'block', padding: '0 6px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name || entry.category}</span>
              ) : ''}
            </Block>
          )
        })}
        {nowMinute !== null && (
          <div aria-hidden style={{ position: 'absolute', top: -2, bottom: -2, left: `${(nowMinute / 1440) * 100}%`, width: 2, background: '#F8FAFC', boxShadow: '0 0 8px rgba(255,255,255,0.8)', pointerEvents: 'none' }} />
        )}
      </div>

      {/* Axis */}
      {showAxis && (
        <div style={{ position: 'relative', height: 16, marginTop: 2, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {[0, 6, 12, 18, 24].map(h => (
            <span key={h} style={{ position: 'absolute', left: `${(h / 24) * 100}%`, transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
              {h === 24 ? '24h' : `${String(h).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>
      )}
      {showAxis && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Tap a block for details · striped = waste time · empty = not logged</div>}
      {/* Click selection detail */}
      {!compact && selected && (
        <div style={{
          marginTop: 8, padding: '10px 12px', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center',
          background: `${categoryColor(selected.entry.category)}14`, border: `1px solid ${categoryColor(selected.entry.category)}40`,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: categoryColor(selected.entry.category), flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.entry.name || selected.entry.category}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.entry.category} · {selected.entry.start}–{selected.entry.end} · {formatMinutes(selected.range.end - selected.range.start)}</div>
          </div>
        </div>
      )}
      {/* Hover tooltip */}
      <BlockTooltip entry={hover.entry} range={hover.range} x={hover.x} y={hover.y} visible={hover.visible} />
    </div>
  )
}

/**
 * Two aligned lanes (Plan on top, Actual below) over the active part of the day,
 * so it is obvious at a glance where the day followed or drifted from the plan.
 */
export function PlanVsActual({ plans = [], entries = [] }) {
  const [selected, setSelected] = useState(null)
  const [hover, setHover] = useState({ visible: false, item: null, kind: '', x: 0, y: 0 })
  const items = [...plans, ...entries].map(toRange).filter(Boolean)
  if (!items.length) return null
  const from = Math.max(0, Math.floor(Math.min(...items.map(r => r.start)) / 60) * 60)
  const to = Math.min(1440, Math.ceil(Math.max(...items.map(r => r.end)) / 60) * 60)
  const span = Math.max(60, to - from)
  const hours = []
  const step = span > 12 * 60 ? 3 : span > 6 * 60 ? 2 : 1
  for (let m = from; m <= to; m += step * 60) hours.push(m)

  const lane = (label, list, kind) => {
    if (!list.length && kind === 'deviations') return null

    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 65, flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ position: 'relative', flex: 1, height: 42, borderRadius: 10, background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.08)', overflow: 'hidden' }}>
            {list.map(item => {
              const r = toRange(item)
              if (!r) return null
              const color = categoryColor(item.category)
              const left = ((Math.max(r.start, from) - from) / span) * 100
              const width = Math.max(((Math.min(r.end, to) - Math.max(r.start, from)) / span) * 100, 0.4)
              const outcome = item.planOutcome
              const isDev = kind === 'deviations'
              const isUnplanned = kind === 'actual' && !item.planSlotId
              const isSel = selected && (
                selected.id === item.id || 
                selected.planSlotId === item.id || 
                item.planSlotId === selected.id || 
                (selected.id && item.id && (String(selected.id).startsWith(String(item.id)) || String(item.id).startsWith(String(selected.id))))
              )
              return (
                <div
                  key={item.id || `${item.start}-${item.name}-${kind}`}
                  onClick={() => setSelected(item)}
                  onMouseEnter={e => setHover({ visible: true, item, kind, x: e.clientX, y: e.clientY })}
                  onMouseMove={e => setHover(h => ({ ...h, x: e.clientX, y: e.clientY }))}
                  onMouseLeave={() => setHover({ visible: false, item: null, kind: '', x: 0, y: 0 })}
                  style={{
                    position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`,
                    background: kind === 'plan' || outcome === 'missed' ? `${color}33` : color,
                    border: kind === 'plan' || outcome === 'missed' ? `1.5px dashed ${color}` : 'none',
                    borderRight: kind === 'plan' || outcome === 'missed' ? 'none' : '1px solid rgba(15,23,42,0.6)',
                    opacity: selected && !isSel ? 0.45 : (hover.item === item ? 1 : (hover.item ? 0.4 : 0.95)),
                    boxShadow: isSel ? `inset 0 0 0 2px #fff` : 'none',
                    transition: 'all .15s ease',
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const hhmmFmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const deviations = []
  
  // 1. Plan deviations (missed parts)
  plans.forEach(p => {
    const pr = toRange(p)
    if (!pr) return
    const actuals = entries.filter(e => e.planSlotId === p.id && !e.ghost && e.planOutcome !== 'missed').map(toRange).filter(Boolean)
    if (!actuals.length) {
      deviations.push({ ...p, name: p.name + ' (missed completely)', planOutcome: 'missed', id: p.id + '-missed' })
      return
    }
    // Simplistic diff for one matching actual
    const a = actuals[0]
    if (a.start > pr.start) deviations.push({ ...p, start: hhmmFmt(pr.start), end: hhmmFmt(Math.min(a.start, pr.end)), name: p.name + ' (missed start)', planOutcome: 'missed', id: p.id + '-missed-start' })
    if (a.end < pr.end) deviations.push({ ...p, start: hhmmFmt(Math.max(a.end, pr.start)), end: hhmmFmt(pr.end), name: p.name + ' (missed end)', planOutcome: 'missed', id: p.id + '-missed-end' })
  })

  // 2. Extra/unplanned parts
  entries.forEach(e => {
    if (e.ghost || e.planOutcome === 'missed') return
    const er = toRange(e)
    if (!er) return
    if (!e.planSlotId) {
      deviations.push(e)
    } else {
      const p = plans.find(plan => plan.id === e.planSlotId)
      if (p) {
        const pr = toRange(p)
        if (pr) {
          if (er.start < pr.start) deviations.push({ ...e, start: hhmmFmt(er.start), end: hhmmFmt(Math.min(er.end, pr.start)), name: e.name + ' (early)', id: e.id + '-early' })
          if (er.end > pr.end) deviations.push({ ...e, start: hhmmFmt(Math.max(er.start, pr.end)), end: hhmmFmt(er.end), name: e.name + ' (extra)', id: e.id + '-extra' })
        }
      } else {
        deviations.push(e)
      }
    }
  })

  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {lane('Plan', plans, 'plan')}
      {lane('Actual', entries, 'actual')}
      {lane('Deviated', deviations, 'deviations')}
      {/* Shared axis */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 65, flexShrink: 0 }} />
        <div style={{ position: 'relative', flex: 1, height: 14, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {hours.map((m, i) => (
            <span key={m} style={{ position: 'absolute', left: `${((m - from) / span) * 100}%`, transform: i === 0 ? 'none' : m >= to ? 'translateX(-100%)' : 'translateX(-50%)' }}>{hhmm(m)}</span>
          ))}
        </div>
      </div>
      {/* Click selection detail */}
      {selected && (
        <div style={{
          marginTop: 8, padding: '10px 12px', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center',
          background: `${categoryColor(selected.category)}14`, border: `1px solid ${categoryColor(selected.category)}40`,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: categoryColor(selected.category), flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name || selected.category}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.category} · {selected.start}–{selected.end} · {formatMinutes((toRange(selected)?.end || 0) - (toRange(selected)?.start || 0))}</div>
          </div>
        </div>
      )}
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 9, borderRadius: 3, border: '1.5px dashed #94A3B8' }} /> Planned</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 9, borderRadius: 3, background: '#94A3B8' }} /> Actually done</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 9, borderRadius: 3, outline: '2px solid #FB7185', outlineOffset: -2 }} /> Changed / missed</span>
      </div>
      {/* Hover tooltip */}
      {hover.visible && hover.item && (
        <HoverCard point={{ x: hover.x, y: hover.y }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{hover.item.name || hover.item.category}</div>
          <div style={{ color: '#94A3B8' }}>{hover.item.start} – {hover.item.end} · {formatMinutes((toRange(hover.item)?.end || 0) - (toRange(hover.item)?.start || 0))}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColor(hover.item.category) }} />
            <span style={{ color: '#818CF8', fontSize: 11 }}>{hover.item.category}</span>
          </div>
          {(hover.kind === 'actual' || hover.kind === 'deviations') && hover.item.planOutcome && (
            <div style={{ marginTop: 2, fontSize: 11, color: hover.item.planOutcome === 'followed' ? '#34D399' : '#FB7185' }}>
              {hover.item.planOutcome === 'followed' ? '✓ Followed plan' : `✗ ${hover.item.planOutcome}`}
            </div>
          )}
        </HoverCard>
      )}
    </div>
  )
}
