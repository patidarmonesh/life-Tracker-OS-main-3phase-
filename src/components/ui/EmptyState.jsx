/**
 * Charming empty state component with inline SVG illustration.
 *
 * @param {{ title?: string, subtitle?: string, icon?: string, action?: { label: string, onClick: () => void } }} props
 */
export default function EmptyState({
  title = 'Nothing here yet',
  subtitle = 'Start adding entries to see them appear here.',
  icon = '📭',
  action,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px',
      textAlign: 'center', animation: 'fadeSlideIn 0.4s ease',
    }}>
      {/* Floating illustration */}
      <div style={{
        fontSize: '56px', marginBottom: '16px',
        animation: 'emptyFloat 3s ease-in-out infinite',
        filter: 'drop-shadow(0 8px 24px rgba(99,102,241,0.15))',
      }}>
        {icon}
      </div>

      {/* Decorative dots */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '20px',
      }}>
        {[0.3, 0.6, 1, 0.6, 0.3].map((opacity, i) => (
          <div key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--accent-indigo)',
            opacity,
          }} />
        ))}
      </div>

      <div style={{
        fontFamily: 'Inter, sans-serif', fontWeight: 700,
        fontSize: '18px', color: 'var(--text-3)',
        marginBottom: '8px',
      }}>
        {title}
      </div>

      <div style={{
        fontSize: '13px', color: 'var(--text-3)',
        maxWidth: '320px', lineHeight: 1.6,
      }}>
        {subtitle}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '20px', padding: '10px 20px',
            borderRadius: '0px', fontSize: '13px', fontWeight: 700,
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border)',
            color: 'var(--text-3)', cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {action.label}
        </button>
      )}

      <style>{`
        @keyframes emptyFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}