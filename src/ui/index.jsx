
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { X, Info } from 'lucide-react'
import { useCountUp } from './hooks'

/* ── Layout ───────────────────────────────────────────────────────────── */
export function Page({ title, subtitle, icon: Icon, color, actions, children, className = '' }) {
  return <div className={`ui-page ${className}`}>
    {(title || actions) && <header className="ui-page-head">
      <div>
        <h1>{Icon && <span className="ui-icon-badge" style={{ '--ib': color }}><Icon size={20} /></span>}{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>}
    {children}
      <div className="h-28 hidden max-md:block"></div>
    </div>
}

export function Card({ title, eyebrow, subtitle, action, accent, glass, interactive, className = '', children, as: Tag = 'section', ...rest }) {
  return <Tag className={`ui-card ${glass ? 'glass' : ''} ${interactive ? 'interactive' : ''} ${className}`} data-accent={accent ? '' : undefined} style={accent ? { '--card-accent': accent, ...rest.style } : rest.style} aria-label={title || eyebrow || 'Card'} {...rest}>
    {(title || eyebrow || action) && <div className="ui-card-head">
      <div>{eyebrow && <div className="ui-eyebrow">{eyebrow}</div>}{title && <h2>{title}</h2>}{subtitle && <div className="ui-sub">{subtitle}</div>}</div>
      {action}
    </div>}
    {children}
  </Tag>
}

/* ── Numbers ──────────────────────────────────────────────────────────── */
export function CountUp({ value, format = v => Math.round(v).toLocaleString('en-IN'), duration = 600 }) {
  const shown = useCountUp(Number.isFinite(value) ? value : 0, duration)
  return <>{Number.isFinite(value) ? format(shown) : '—'}</>
}

/**
 * StatCard — best honest number big, truth one tap away.
 * value: number|null · format(n)→string · placeholder: {label, onClick|to} shown when value is null.
 */
export function StatCard({ label, value, format, unit, icon: Icon, color, note, delta, deltaGood = 'up', truth, placeholder, to, onClick, className = '' }) {
  const body = <>
    <div className="ui-stat-label"><span>{label}</span>{truth ? <TruthBadge {...truth} /> : Icon && <Icon size={16} style={{ color }} />}</div>
    <div className="ui-stat-value" style={{ '--stat-color': color }}>
      {value == null ? (placeholder ? <PlaceholderAction {...placeholder} /> : <span style={{ color: 'var(--text-3)' }}>—</span>) : <><CountUp value={value} format={format} />{unit && <span className="unit">{unit}</span>}</>}
    </div>
    {(note || delta != null) && <div className="ui-stat-note">{delta != null && Number.isFinite(delta) && <span className={`ui-delta ${(delta >= 0) === (deltaGood === 'up') ? 'up' : 'down'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%</span>}{note}</div>}
  </>
  if (to) return <Link to={to} className={`ui-card interactive ui-stat ${className}`}>{body}</Link>
  return <div className={`ui-card ${onClick ? 'interactive' : ''} ui-stat ${className}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>{body}</div>
}

function PlaceholderAction({ label, to, onClick }) {
  if (to) return <Link className="ui-placeholder" to={to}>{label}</Link>
  return <button type="button" className="ui-placeholder" onClick={e => { e.stopPropagation(); onClick?.() }}>{label}</button>
}

/** TruthBadge: ✓ complete · ◐ partial · ? not enough data. Popover shows the maths. */
export function TruthBadge({ status = 'complete', label, rows = [], note }) {
  const [open, setOpen] = useState(false), ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const symbol = status === 'complete' ? '✓' : status === 'partial' ? '◐' : '?'
  return <span className="ui-truth" data-status={status} ref={ref}>
    <button type="button" aria-expanded={open} aria-label={`How is this calculated? ${label || status}`} onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}>{symbol}{label ? ` ${label}` : ''}</button>
    {open && <span className="ui-popover" role="dialog" onClick={e => e.stopPropagation()}>
      <strong style={{ color: 'var(--text-1)', display: 'flex', gap: 6, alignItems: 'center' }}><Info size={14} />How this is calculated</strong>
      {rows.length > 0 && <dl>{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>}
      {note && <p style={{ marginTop: 8 }}>{note}</p>}
    </span>}
  </span>
}

/* ── Controls ─────────────────────────────────────────────────────────── */
export function Button({ variant = 'primary', size, icon: Icon, loading, children, className = '', to, ...props }) {
  const cls = `ui-btn ${variant} ${size || ''} ${!children ? 'icon' : ''} ${className}`
  const content = <>{loading ? <span className="spin" style={{ width: 14, height: 14, border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> : Icon && <Icon size={size === 'sm' ? 14 : 16} />}{children}</>
  const ariaLabel = props['aria-label'] || (typeof children === 'string' ? children : undefined)
  if (to) return <Link to={to} className={cls} aria-label={ariaLabel} {...props}>{content}</Link>
  return <button type="button" className={cls} disabled={props.disabled || loading} aria-label={ariaLabel} {...props}>{content}</button>
}

export function Tabs({ tabs, value, onChange, id, className = '' }) {
  const groupId = useId(), layoutId = `tab-pill-${id || groupId}`
  return <div className={`ui-tabs ${className}`} role="tablist">
    {tabs.map(tab => {
      const selected = tab.key === value, Icon = tab.icon
      return <button key={tab.key} type="button" role="tab" aria-selected={selected} className="ui-tab" onClick={() => onChange(tab.key)}>
        {selected && <motion.i layoutId={layoutId} className="ui-tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
        <span>{Icon && <Icon size={15} />}{tab.label}{tab.badge ? <em style={{ fontStyle: 'normal', fontSize: '.7rem', background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '0 .4rem' }}>{tab.badge}</em> : null}</span>
      </button>
    })}
  </div>
}

export function Chips({ options, value, onChange, multiple = false }) {
  const isOn = key => multiple ? value.includes(key) : value === key
  return <div className="ui-chips" role="group">{options.map(o => {
    const key = typeof o === 'string' ? o : o.key, label = typeof o === 'string' ? o : o.label, color = o.color
    return <button key={key} type="button" className="ui-chip" aria-pressed={isOn(key)} style={color ? { '--chip-color': `color-mix(in srgb, ${color} 22%, transparent)`, '--chip-border': color } : undefined}
      onClick={() => onChange(multiple ? (isOn(key) ? value.filter(v => v !== key) : [...value, key]) : key)}>{color && <span className="ui-dot" style={{ '--dot': color }} />}{o.emoji}{label}</button>
  })}</div>
}

export function Field({ label, children, hint, error }) {
  return <label className="ui-field"><span>{label}</span>{children}{(hint || error) && <small style={{ color: error ? 'var(--danger-ink)' : 'var(--text-3)', fontSize: '.75rem' }}>{error || hint}</small>}</label>
}

export function MoneyInput({ value, onChange, symbol = '₹', ...props }) {
  return <div className="ui-money"><em>{symbol}</em><input inputMode="decimal" className="ui-input" value={value} onChange={e => onChange(e.target.value.replace(/[^\d.]/g, ''))} {...props} /></div>
}

/* ── Visuals ──────────────────────────────────────────────────────────── */
export function Ring({ value, upper, size = 120, stroke = 10, color = 'var(--accent)', upperColor, track = 'rgba(148,163,184,.14)', children, glow = true }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value ?? 0)), u = upper != null ? Math.max(v, Math.min(1, upper)) : null
  return <div className="ui-ring" style={{ width: size, height: size }}>
    <svg width={size} height={size} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {u != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={upperColor || color} strokeOpacity=".28" strokeWidth={stroke} strokeDasharray={`${c * u} ${c}`} strokeLinecap="round" />}
      <circle className="ui-ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={value == null ? c : c * (1 - v)}
        style={{ '--ring-c': c, animation: `ringDraw var(--dur-4) var(--ease-out-expo) both`, filter: glow ? `drop-shadow(0 0 8px ${typeof color === 'string' && color.startsWith('#') ? color + '88' : 'rgba(99,102,241,.5)'})` : undefined }} />
    </svg>
    <div className="ui-ring-center">{children}</div>
  </div>
}

export function ProgressBar({ value, color, height = 8, marker, label }) {
  const v = Math.max(0, Math.min(1, value ?? 0))
  return <div className="ui-progress" style={{ '--h': `${height}px` }} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <i style={{ transform: `scaleX(${v})`, '--bar': color, animation: 'none', transition: 'transform var(--dur-4) var(--ease-spring)' }} />
    {marker != null && <b style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />}
  </div>
}

export function EmptyState({ emoji = '✨', title, text, action }) {
  return <div className="ui-empty"><div className="emoji" aria-hidden="true">{emoji}</div><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>
}

export function Status({ tone = 'info', children, role }) {
  return <div className={`ui-status ${tone === 'info' ? '' : tone}`} role={role || (tone === 'error' ? 'alert' : 'status')}>{children}</div>
}

export function Skeleton({ height = 80, radius = 0 }) { return <div className="shimmer" style={{ height, borderRadius: radius }} /> }

/** Bottom sheet on mobile (drag to dismiss), dialog on desktop. Focus-trapped, Esc closes. */
export function Sheet({ open, onClose, title, children, width, footer }) {
  const panel = useRef(null), titleId = useId(), reduce = useReducedMotion()
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => panel.current?.querySelector('input,textarea,select,button:not([data-close])')?.focus(), 60)
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.() }
      if (e.key !== 'Tab' || !panel.current) return
      const els = [...panel.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]')].filter(el => el.getClientRects().length)
      if (!els.length) return
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els.at(-1).focus() }
      else if (!e.shiftKey && document.activeElement === els.at(-1)) { e.preventDefault(); els[0].focus() }
    }
    document.addEventListener('keydown', key)
    return () => { clearTimeout(t); document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus?.() }
  }, [open])
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  return createPortal(<AnimatePresence>{open && <motion.div className="ui-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
    <motion.section ref={panel} className="ui-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ '--sheet-w': width }}
      initial={reduce ? false : mobile ? { y: '100%' } : { opacity: 0, scale: .96, y: 12 }} animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }} exit={mobile ? { y: '100%' } : { opacity: 0, scale: .97, y: 8 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      drag={mobile ? 'y' : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: .6 }} onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose?.() }}>
      <div className="ui-sheet-grip" aria-hidden="true" />
      <header className="ui-sheet-head"><h2 id={titleId}>{title}</h2><button type="button" data-close className="ui-btn ghost icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
      {children}
      {footer && <div style={{ position: 'sticky', bottom: '-1.25rem', background: 'var(--card)', paddingTop: '.75rem', marginTop: '1rem', display: 'flex', gap: '.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>{footer}</div>}
    </motion.section>
  </motion.div>}</AnimatePresence>, document.body)
}

/** Earned celebration only (plan §12.6). Renders once, then unmounts itself. */
export function Confetti({ fire, onDone }) {
  const [pieces, setPieces] = useState([])
  useEffect(() => {
    if (!fire || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#22D3EE']
    const start = setTimeout(() => setPieces(Array.from({ length: 70 }, (_, i) => ({ id: i, left: Math.random() * 100, delay: Math.random() * .4, color: colors[i % colors.length], rot: Math.random() * 360 }))), 0)
    const t = setTimeout(() => { setPieces([]); onDone?.() }, 1900)
    return () => { clearTimeout(start); clearTimeout(t) }
  }, [fire, onDone])
  if (!pieces.length) return null
  return createPortal(<div className="ui-confetti" aria-hidden="true">{pieces.map(p => <i key={p.id} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }} />)}</div>, document.body)
}

export function Legend({ items }) {
  return <div className="ui-heat-legend">{items.map(([color, label]) => <span key={label} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><i style={{ background: color }} />{label}</span>)}</div>
}

export function Quality({ warnings = [] }) {
  if (!warnings.length) return null
  return <details className="ui-quality"><summary>Data quality · {warnings.length} note{warnings.length > 1 ? 's' : ''}</summary><ul style={{ margin: '.5rem 0 0 1rem' }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>
}

export { default as HeatCalendar } from './calendar/HeatCalendar'
export { default as DateNavigator } from './calendar/DateNavigator'
export { default as YearHeatmap } from './calendar/YearHeatmap'
