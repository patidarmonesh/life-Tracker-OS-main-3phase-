import { hapticLight } from '../../hooks/useHaptic'

const variants = {
  primary: { background: 'linear-gradient(135deg, #6366F1, #7C3AED)', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(99,102,241,0.25)' },
  secondary: { background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: 'none' },
  danger: { background: 'linear-gradient(135deg, #F43F5E, #E11D48)', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(244,63,94,0.25)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: 'none', boxShadow: 'none' },
}

export default function Button({ children, variant = 'primary', onClick, disabled, className = '', type = 'button', style = {} }) {
  return (
    <button
      type={type}
      onClick={e => {
        if (!disabled) hapticLight()
        onClick?.(e)
      }}
      disabled={disabled}
      className={`ripple-btn ${className}`}
      style={{
        ...variants[variant],
        padding: '11px 20px',
        borderRadius: '12px',
        fontSize: '13.5px',
        fontWeight: '700',
        fontFamily: 'DM Sans, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        letterSpacing: '-0.01em',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        ...style,
      }}
      onPointerDown={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'scale(0.96) translateY(1px)'
          e.currentTarget.style.filter = 'brightness(0.92)'
        }
      }}
      onPointerUp={e => {
        e.currentTarget.style.transform = 'scale(1) translateY(0)'
        e.currentTarget.style.filter = 'brightness(1)'
      }}
      onPointerLeave={e => {
        e.currentTarget.style.transform = 'scale(1) translateY(0)'
        e.currentTarget.style.filter = 'brightness(1)'
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.filter = 'brightness(1.12)'
          e.currentTarget.style.transform = 'translateY(-1px)'
          if (variant === 'primary') e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.35)'
          if (variant === 'danger') e.currentTarget.style.boxShadow = '0 6px 20px rgba(244,63,94,0.35)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = 'brightness(1)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = variants[variant]?.boxShadow || 'none'
      }}
    >
      {children}
    </button>
  )
}
