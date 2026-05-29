export default function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.background = 'var(--bg-card-hover)'
          e.currentTarget.style.borderColor = 'var(--border-focus)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-card)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {children}
    </div>
  )
}