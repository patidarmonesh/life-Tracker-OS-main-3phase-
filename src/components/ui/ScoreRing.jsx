export default function ScoreRing({ score = 0, size = 160, strokeWidth = 12, label = 'Score' }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F43F5E'

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={circ - fill}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: size * 0.22, fontWeight: '800', fontFamily: 'Syne, sans-serif', color }}>{score}</div>
        <div style={{ fontSize: size * 0.1, color: 'var(--text-muted)', fontWeight: '500' }}>{label}</div>
      </div>
    </div>
  )
}