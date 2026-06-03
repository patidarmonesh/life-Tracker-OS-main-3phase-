/**
 * Skeleton loading placeholder with shimmer animation.
 * Use as a placeholder while data is loading.
 */
export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-card-hover) 50%, var(--bg-secondary) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite ease-in-out',
      ...style,
    }} />
  )
}

/**
 * Skeleton card with multiple rows, mimics a data card while loading.
 */
export function SkeletonCard({ rows = 3 }) {
  return (
    <div style={{
      padding: '20px', borderRadius: '16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <Skeleton width="40%" height={14} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={i}
          width={`${70 + Math.random() * 30}%`}
          height={12}
          style={{ marginBottom: i < rows - 1 ? 10 : 0 }}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton metric card, mimics a number + label card.
 */
export function SkeletonMetric() {
  return (
    <div style={{
      padding: '16px', borderRadius: '14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <Skeleton width={32} height={32} borderRadius="50%" style={{ margin: '0 auto 10px' }} />
      <Skeleton width="60%" height={20} style={{ margin: '0 auto 8px' }} />
      <Skeleton width="80%" height={10} style={{ margin: '0 auto' }} />
    </div>
  )
}