const variants = {
  primary: { background: 'linear-gradient(135deg, #6366F1, #7C3AED)', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(99,102,241,0.25)' },
  secondary: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: 'none' },
  danger: { background: 'linear-gradient(135deg, #F43F5E, #E11D48)', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(244,63,94,0.25)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: 'none', boxShadow: 'none' },
}

export default function Button({ children, variant = 'primary', onClick, disabled, className = '', type = 'button', style = {} }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ripple-btn ${className}`}
      style={{
        ...variants[variant],
        padding: '10px 18px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '700',
        fontFamily: 'DM Sans, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        letterSpacing: '-0.01em',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
