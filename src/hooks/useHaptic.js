/**
 * Trigger a subtle haptic vibration on supported devices.
 * Falls back silently on devices that don't support the Vibration API.
 *
 * Usage:
 *   import { haptic } from '../hooks/useHaptic'
 *   <button onClick={() => { haptic(); doSomething() }}>Tap me</button>
 */

const supportsVibration = typeof navigator !== 'undefined' && 'vibrate' in navigator

/**
 * Light tap feedback — 10ms vibration.
 */
export function hapticLight() {
  if (supportsVibration) {
    try { navigator.vibrate(10) } catch { /* silently ignore */ }
  }
}

/**
 * Medium tap feedback — 20ms vibration.
 */
export function hapticMedium() {
  if (supportsVibration) {
    try { navigator.vibrate(20) } catch { /* silently ignore */ }
  }
}

/**
 * Success pattern — two short pulses.
 */
export function hapticSuccess() {
  if (supportsVibration) {
    try { navigator.vibrate([15, 50, 15]) } catch { /* silently ignore */ }
  }
}

/**
 * Warning/error pattern — one longer pulse.
 */
export function hapticWarning() {
  if (supportsVibration) {
    try { navigator.vibrate(40) } catch { /* silently ignore */ }
  }
}

// Default export for simple usage: haptic()
export const haptic = hapticLight
