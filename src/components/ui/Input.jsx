export default function Input({ label, value, onChange, type = 'text', placeholder, prefix }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '14px' }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '11px 14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
          }}
          onFocus={e => e.currentTarget.parentElement.style.borderColor = 'var(--border-focus)'}
          onBlur={e => e.currentTarget.parentElement.style.borderColor = 'var(--border)'}
        />
      </div>
    </div>
  )
}