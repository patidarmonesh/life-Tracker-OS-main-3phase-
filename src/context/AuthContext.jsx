import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  getStoredSession,
  initializeGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
} from '../services/authService'
import {
  ensureBillsFolder,
  ensureInitialFiles,
  initializeDrive,
} from '../services/driveService'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let mounted = true

    async function boot() {
      try {
        setIsLoading(true)
        setAuthError('')

        await initializeGoogleAuth()

        const session = getStoredSession()
        if (session?.user && mounted) {
          setUser(session.user)
          try {
            await initializeDrive()
            await ensureBillsFolder()
            await ensureInitialFiles()
          } catch (driveError) {
            console.error('Drive init failed on boot:', driveError)
          }
        }

        if (mounted) setIsAuthReady(true)
      } catch (error) {
        console.error('Auth initialization failed:', error)
        if (mounted) {
          setAuthError(error.message || 'Failed to initialize Google auth')
          setIsAuthReady(true)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    boot()
    return () => {
      mounted = false
    }
  }, [])

  const login = async () => {
    try {
      setIsLoading(true)
      setAuthError('')

      const session = await signInWithGoogle()
      setUser(session.user)

      await initializeDrive()
      await ensureBillsFolder()
      await ensureInitialFiles()

      return session.user
    } catch (error) {
      console.error('Login failed:', error)
      setAuthError(error.message || 'Google sign-in failed')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    signOutGoogle()
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
    }),
    [user, isLoading, isAuthReady, authError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
