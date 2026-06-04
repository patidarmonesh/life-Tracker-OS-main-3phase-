import { useEffect, useMemo, useState } from 'react'
import {
  getStoredSession,
  initializeGoogleAuth,
  refreshAccessToken,
  signInWithGoogle,
  signOutGoogle,
  onTokenRefresh,
  startTokenRefreshWatcher,
  installTokenRefreshListeners,
  removeTokenRefreshListeners,
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
        // This MUST complete before startTokenRefreshWatcher() is called,
        // otherwise the watcher fires with a null tokenClient and silently fails.
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

        // ── Step 3: If we have a session, check if token needs an immediate
        //           refresh (e.g. app reopened after 30 min, token near dead)
        if (session?.user) {
          // Fire a silent refresh immediately — don't wait for the watcher
          // This handles the "reopen browser" case where token has < 5 min left
          const freshToken = await refreshAccessToken()
          if (freshToken) {
            console.log('[AuthContext] Boot: silent token refresh OK')
          } else {
            console.warn('[AuthContext] Boot: silent refresh failed — user may need to re-login if Drive calls fail')
          }

          // ── Step 4: Start the 30-second watcher loop ─────────────────────
          startTokenRefreshWatcher()
          installTokenRefreshListeners()
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
    signOutGoogle()   // clears session + stops watcher
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
