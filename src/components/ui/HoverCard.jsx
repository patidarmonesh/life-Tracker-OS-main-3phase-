import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** point = {x,y} in viewport px (clientX/Y). Portal ⇒ backdrop-filter/transform ancestors ka asar nahi. */
export default function HoverCard({ point, children, interactive = false, onDismiss }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })
  
  useLayoutEffect(() => {
    if (!point || !ref.current) return
    const { width: w, height: h } = ref.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight, pad = 8, gap = 14
    let left = point.x + gap, top = point.y - h - gap
    if (left + w > vw - pad) left = point.x - w - gap       // right edge: flip left
    if (left < pad) left = pad
    if (top < pad) top = point.y + gap                        // top edge: flip below
    if (top + h > vh - pad) top = vh - h - pad
    setPos({ left, top })
  }, [point?.x, point?.y, children])
  
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])
  
  if (!point) return null
  
  return createPortal(
    <div ref={ref} role="tooltip" style={{ 
      position: 'fixed', ...pos, zIndex: 10000, pointerEvents: interactive ? 'auto' : 'none',
      background: 'rgba(15,23,42,.97)', border: '1px solid rgba(148,163,184,.2)', borderRadius: 12, padding: '10px 12px',
      boxShadow: '0 12px 32px rgba(0,0,0,.5)', color: '#F8FAFC', fontSize: 12, maxWidth: 280 
    }}>
      {children}
    </div>,
    document.body
  )
}
