export default function Card({ children, className = '', onClick, style = {} }) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        padding: '20px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        ...style,
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.background = 'var(--bg-card-hover)'
          e.currentTarget.style.borderColor = 'var(--border-focus)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.18)'
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
