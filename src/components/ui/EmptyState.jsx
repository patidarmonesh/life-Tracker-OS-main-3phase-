export default function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>{icon}</div>
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '14px', marginBottom: '16px' }}>{subtitle}</p>}
      {action}
    </div>
  )
}