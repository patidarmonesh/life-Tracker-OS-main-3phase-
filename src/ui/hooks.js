import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates a number from its previous value to `target` (easeOutExpo). Instant under reduced motion. */
export function useCountUp(target, duration = 600) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target || reduceMotion() || typeof requestAnimationFrame === 'undefined') {
      from.current = target
      const t = setTimeout(() => setShown(target), 0)
      return () => clearTimeout(t)
    }
    let raf, t0
    const step = time => {
      t0 ??= time
      const p = Math.min(1, (time - t0) / duration)
      const eased = p === 1 ? 1 : 1 - 2 ** (-10 * p)
      const value = start + (target - start) * eased
      from.current = value
      setShown(value)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return shown
}

/* Shared visibility store so every live clock pauses together when the tab is hidden. */
const visibilityListeners = new Set()
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.documentElement.dataset.hidden = ''
    else delete document.documentElement.dataset.hidden
    visibilityListeners.forEach(l => l())
  })
}
const subscribeVisibility = l => { visibilityListeners.add(l); return () => visibilityListeners.delete(l) }
const getVisible = () => typeof document === 'undefined' || !document.hidden

export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, getVisible, () => true)
}

/** Current epoch ms, refreshed every `intervalMs` while the page is visible. */
export function useLiveNow(intervalMs = 30000) {
  const visible = usePageVisible()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!visible) return
    const kick = setTimeout(() => setNow(Date.now()), 0)
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => { clearTimeout(kick); clearInterval(id) }
  }, [intervalMs, visible])
  return now
}

export function useMediaQuery(query) {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Persisted UI preference (not domain data). */
export function useLocalPref(key, initial) {
  const [value, setValue] = useState(() => {
    try { const raw = localStorage.getItem(`lifeos_pref_${key}`); return raw == null ? initial : JSON.parse(raw) } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(`lifeos_pref_${key}`, JSON.stringify(value)) } catch { /* private mode */ } }, [key, value])
  return [value, setValue]
}
