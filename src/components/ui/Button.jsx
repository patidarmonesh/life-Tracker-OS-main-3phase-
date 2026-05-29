const variants = {
  primary: { background: 'var(--accent-indigo)', color: '#fff', border: 'none' },
  secondary: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  danger: { background: 'var(--accent-rose)', color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: 'none' },
}

export default function Button({ children, variant = 'primary', onClick, disabled, className = '', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        ...variants[variant],
        padding: '10px 18px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        fontFamily: 'DM Sans, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {children}
    </button>
  )
}