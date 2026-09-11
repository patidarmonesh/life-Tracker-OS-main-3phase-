import { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  const backdropRef = useRef(null)
  const contentRef = useRef(null)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, handleKeyDown])

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
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px 16px',
        overflowY: 'auto',
        animation: 'modalBackdropFadeIn 0.25s ease',
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="modal-content"
        style={{
          background: 'linear-gradient(180deg, rgba(26,34,53,0.98) 0%, rgba(15,23,42,0.99) 100%)',
          border: '1px solid rgba(148,163,184,0.08)',
          borderRadius: '22px',
          padding: '22px',
          width: '100%', maxWidth: '500px',
          margin: 'auto',
          maxHeight: 'none',
          animation: 'modalFadeIn 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          outline: 'none',
          boxShadow: '0 25px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.04)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '18px', paddingBottom: '14px',
          borderBottom: '1px solid rgba(148,163,184,0.06)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em', margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-muted)', cursor: 'pointer',
              padding: '7px', borderRadius: '10px', width: '34px', height: '34px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#F43F5E'
              e.currentTarget.style.background = 'rgba(244,63,94,0.08)'
              e.currentTarget.style.borderColor = 'rgba(244,63,94,0.2)'
              e.currentTarget.style.transform = 'rotate(90deg)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.transform = 'rotate(0deg)'
            }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
