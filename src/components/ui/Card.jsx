export default function Card({ children, className = '', onClick, style = {} }) {
  return (
    <div
      onClick={onClick}
      className={`${onClick ? 'metric-card-hover' : ''} ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        padding: '20px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.background = 'var(--bg-card-hover)'
          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = style.background || 'var(--bg-card)'
        e.currentTarget.style.borderColor = style.borderColor || style.border?.split(' ').pop() || 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = style.boxShadow || '0 2px 12px rgba(0,0,0,0.08)'
      }}
    >
      {children}
    </div>
  )
}
