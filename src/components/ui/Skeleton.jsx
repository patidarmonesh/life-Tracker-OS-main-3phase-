export default function Skeleton({ width = '100%', height = '20px', borderRadius = '8px' }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

// Add this to index.css:
// @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }