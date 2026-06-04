/**
 * useTokenStatus.js
 *
 * A hook that monitors the Google access token status and exposes
 * a `needsReconnect` boolean + a `reconnect()` function.
 *
 * How it works:
 *  - Every 30 seconds, checks if the stored token is expired.
 *  - When the tab gets focus / comes back online, re-checks immediately.
 *  - Sets needsReconnect=true when the token is dead AND we have a session
 *    (user is "logged in" but token expired — not logged out).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  getStoredSession,
  getAccessToken,
  refreshAccessToken,
} from '../services/authService'

const CHECK_INTERVAL_MS = 30_000 // 30 seconds

export function useTokenStatus() {
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const checkStatus = useCallback(() => {
    const session = getStoredSession()
    if (!session?.user) {
      // No session at all — user is logged out, not our job
      setNeedsReconnect(false)
      return
    }

    const token = getAccessToken()
    // Has session but no valid token → needs reconnect
    setNeedsReconnect(!token)
  }, [])

  useEffect(() => {
    // Check immediately on mount
    checkStatus()

    // Poll every 30 s
    const id = setInterval(checkStatus, CHECK_INTERVAL_MS)

    // Also check on focus / visibility / online
    const onFocus = () => checkStatus()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkStatus()
    }
    const onOnline = () => checkStatus()

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)

    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [checkStatus])

  const reconnect = useCallback(async () => {
    setIsReconnecting(true)
    try {
      const token = await refreshAccessToken()
      if (token) {
        setNeedsReconnect(false)
      }
      // If still null, needsReconnect stays true — user will see banner
      return !!token
    } catch {
      return false
    } finally {
      setIsReconnecting(false)
    }
  }, [])

  return { needsReconnect, isReconnecting, reconnect }
}
