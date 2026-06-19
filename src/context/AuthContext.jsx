import { useEffect, useMemo, useState } from 'react'
import {
  getStoredSession,
  initializeGoogleAuth,
  attemptAutoLogin,
  signInWithGoogle,
  signOutGoogle,
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

        // ── Step 1: Restore session from localStorage ──────────────────────
        const session = getStoredSession()
        if (session?.user && mounted) {
          setUser(session.user)
        }

        // ── Step 2: Initialize the GIS tokenClient FIRST ───────────────────
        // This MUST complete before any token operations are attempted,
        // otherwise the tokenClient is null and all requests silently fail.
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

        // ── Step 3: Attempt auto-login ─────────────────────────────────────
        // Uses a multi-strategy approach:
        //   1. Silent token refresh (existing session still valid)
        //   2. Google One Tap auto-select (returning user, no click needed)
        //   3. Falls back to manual login if both fail
        const autoResult = await attemptAutoLogin()

        if (autoResult && mounted) {
          if (autoResult.token) {
            // Full auto-login success — we have both identity and Drive access
            if (autoResult.user) setUser(autoResult.user)
            console.log(`[AuthContext] Boot: auto-login succeeded via ${autoResult.strategy}`)

            // Start the 30-second watcher loop for proactive token refresh
            startTokenRefreshWatcher()
            installTokenRefreshListeners()
          } else if (autoResult.user) {
            // Partial success — One Tap identified the user but Drive token
            // needs a consent popup. Set user so UI shows who they are,
            // but they'll need to click "Continue with Google" for Drive access.
            setUser(autoResult.user)
            console.warn('[AuthContext] Boot: user identified but Drive token needs manual consent')
          }
        } else if (session?.user && mounted) {
          // Auto-login failed but we have a cached user — keep showing them
          // but they'll need to re-authenticate when Drive calls fail
          console.warn('[AuthContext] Boot: auto-login failed — cached user kept, may need re-login')
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

    // Listen for silent token refreshes to log them (could also update UI here)
    const unsubscribe = onTokenRefresh(({ token }) => {
      if (mounted && token) {
        console.log('[AuthContext] Token silently refreshed ✓')
      }
    })

    return () => {
      mounted = false
      unsubscribe()
      removeTokenRefreshListeners()
    }
  }, [])

  const login = async () => {
    try {
      setIsLoading(true)
      setAuthError('')

      const session = await signInWithGoogle()
      if (session?.user) {
        setUser(session.user)
        // signInWithGoogle already calls startTokenRefreshWatcher()
        installTokenRefreshListeners()
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

  const logout = () => {
    signOutGoogle()   // clears session + stops watcher + disables auto-select
    disableAutoSelect()  // extra safety: prevent One Tap auto-login loop
    removeTokenRefreshListeners()
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
      isLoading,
      isAuthReady,
      authError,
      isAuthenticated: !!user,
      setAuthError,
    }),
    [user, isLoading, isAuthReady, authError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
