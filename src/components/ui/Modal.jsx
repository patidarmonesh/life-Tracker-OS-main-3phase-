import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { hapticLight } from '../../hooks/useHaptic'

export default function Modal({ isOpen, onClose, title, children }) {
  const backdropRef = useRef(null)
  const contentRef = useRef(null)
  const [rendered, setRendered] = useState(false)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    hapticLight()
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      setRendered(false)
      document.body.style.overflow = ''
      onClose?.()
    }, 220)
  }, [onClose])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') handleClose()
  }, [handleClose])

  useEffect(() => {
    if (isOpen) {
      setRendered(true)
      setClosing(false)
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, handleKeyDown])

  useEffect(() => {
    if (rendered && !closing && contentRef.current) {
      contentRef.current.focus()
    }
  }, [rendered, closing])

  if (!rendered && !isOpen) return null

  return (
    <div
      ref={backdropRef}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0,
        background: closing ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.6)',
        backdropFilter: closing ? 'blur(0px)' : 'blur(16px)',
        WebkitBackdropFilter: closing ? 'blur(0px)' : 'blur(16px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px 16px',
        overflowY: 'auto',
        opacity: closing ? 0 : 1,
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: closing ? 'none' : 'modalBackdropFadeIn 0.25s ease',
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
          outline: 'none',
          boxShadow: '0 25px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          WebkitTapHighlightColor: 'transparent',
          transform: closing ? 'scale(0.95) translateY(12px)' : 'scale(1) translateY(0)',
          opacity: closing ? 0 : 1,
          transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: closing ? 'none' : 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
            onClick={handleClose}
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
