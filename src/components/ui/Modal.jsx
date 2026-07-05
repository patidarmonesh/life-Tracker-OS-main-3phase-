import { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  const backdropRef = useRef(null)
  const contentRef = useRef(null)

  // Close on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent background scroll
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, handleKeyDown])

  // Focus trap: focus content on open
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px 16px',
        overflowY: 'auto',
        animation: 'modalBackdropFadeIn 0.2s ease',
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="modal-content"
        style={{
          background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(15,23,42,0.98) 100%)',
          border: '1px solid rgba(148,163,184,0.10)',
          borderRadius: '22px',
          padding: '24px',
          width: '100%', maxWidth: '500px',
          margin: 'auto',
          maxHeight: 'none',
          animation: 'modalFadeIn 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          outline: 'none',
          boxShadow: '0 25px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-muted)', cursor: 'pointer',
              padding: '8px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#F43F5E'
              e.currentTarget.style.background = 'rgba(244,63,94,0.08)'
              e.currentTarget.style.borderColor = 'rgba(244,63,94,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
