import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getStoredSession,
  getAccessToken,
  initializeGoogleAuth,
  attemptAutoLogin,
  signInWithGoogle,
  signOutGoogle,
  reconnectGoogle,
  onTokenRefresh,
  startTokenRefreshWatcher,
  installTokenRefreshListeners,
  removeTokenRefreshListeners,
  disableAutoSelect,
} from '../services/authService'
import { AuthContext } from './appContextCore'

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [isLoading,   setIsLoading]   = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authError,   setAuthError]   = useState('')

  useEffect(() => {
    let mounted = true

    async function boot() {
      try {
        setIsLoading(true)
        setAuthError('')

        // ── Step 1: Restore session from localStorage (NO network call) ───
        // This is instant — no popup, no Google API call.
        const session = getStoredSession()
        if (session?.user && mounted) {
          setUser(session.user)
        }

        // ── Step 2: Initialize the GIS tokenClient ────────────────────────
        // Just loads the script, does NOT trigger any popup or auth flow.
        try {
          await initializeGoogleAuth()
        } catch (googleError) {
          console.error('[AuthContext] Google auth script failed:', googleError)
          if (mounted) {
            setAuthError(
              googleError.message || 'Failed to initialize Google auth'
            )
          }
          // Don't bail out — the user can still use the app with cached data
        }

        // ── Step 3: Check stored session validity (NO popup) ──────────────
        // attemptAutoLogin() now ONLY checks localStorage — no network call,
        // no One Tap, no silent refresh, no popup. Instant.
        const isLoggedOut = localStorage.getItem('lifeos_logged_out') === 'true'

        if (!isLoggedOut && mounted) {
          const autoResult = await attemptAutoLogin()

          if (autoResult) {
            if (autoResult.token) {
              // Valid token — fully logged in, Drive sync will work
              if (autoResult.user) setUser(autoResult.user)
              console.log(`[AuthContext] Boot: session restored (token valid)`)
              try {
                localStorage.removeItem('lifeos_logged_out')
              } catch {}
            } else if (autoResult.user) {
              // Token expired but user profile exists — show user as logged in
              // Drive sync will fail and show "Reconnect" banner (no popup!)
              setUser(autoResult.user)
              console.log('[AuthContext] Boot: session restored (token expired, Reconnect needed)')
            }
          }
        } else if (isLoggedOut) {
          console.log('[AuthContext] Boot: User is explicitly logged out')
        }

        if (mounted) setIsAuthReady(true)
      } catch (error) {
        console.error('[AuthContext] Auth initialization failed:', error)
        if (mounted) {
          setAuthError(error.message || 'Failed to initialize Google auth')
          setIsAuthReady(true)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    boot()

    // Listen for token acquisitions (from login or reconnect)
    const unsubscribe = onTokenRefresh(({ token }) => {
      if (mounted && token) {
        console.log('[AuthContext] Token acquired ✓')
      }
    })

    // Install visibility listener for auto-reconnect on tab focus
    const cleanupListeners = installTokenRefreshListeners()

    return () => {
      mounted = false
      unsubscribe()
      if (typeof cleanupListeners === 'function') cleanupListeners()
    }
  }, [])

  const login = async () => {
    try {
      setIsLoading(true)
      setAuthError('')

      const session = await signInWithGoogle()
      if (session?.user) {
        setUser(session.user)
        try {
          localStorage.removeItem('lifeos_logged_out')
        } catch {}
      }

      return session?.user ?? null
    } catch (error) {
      console.error('[AuthContext] Login failed:', error)
      setAuthError(error.message || 'Google sign-in failed')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // ── Reconnect: user-initiated re-auth when token has expired ──────────
  // This opens a popup ONCE. Uses prompt:'' so Google auto-selects the
  // existing account — usually the popup opens and closes in ~1 second.
  const reconnect = useCallback(async () => {
    try {
      setAuthError('')
      const session = await reconnectGoogle()
      if (session?.user) {
        setUser(session.user)
      }
      return session
    } catch (error) {
      console.error('[AuthContext] Reconnect failed:', error)
      setAuthError(error.message || 'Reconnect failed')
      throw error
    }
  }, [])

  const logout = () => {
    try {
      localStorage.setItem('lifeos_logged_out', 'true')
    } catch {}
    signOutGoogle()   // clears session
    disableAutoSelect()
    setUser(null)
    setAuthError('')
    localStorage.removeItem('lifeos_drive_folder_id')
    localStorage.removeItem('lifeos_drive_bills_folder_id')
  }

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      reconnect,
      isLoading,
      isAuthReady,
      authError,
      isAuthenticated: !!user,
      setAuthError,
    }),
    [user, isLoading, isAuthReady, authError, reconnect]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
