import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import {
  sampleExpenses,
  sampleSessions,
  sampleCheckpoints,
  sampleHabitLogs,
  sampleTimeEntries,
  sampleJournal,
  sampleHealthLogs,
  sampleSettings,
} from '../data/sampleData'
import {
  syncAll,
  autoSave,
  ensureInitialFiles,
  deleteAllFiles,
  clearDriveCache,
} from '../services/driveService'
import { stripGeminiKeyFromSettings } from '../services/geminiService'
import { getAccessToken } from '../services/authService'
import { useAuth } from './AuthContext'
import { AppActionsContext, AppStateContext } from './appContextCore'

const STORAGE_KEY = 'lifeos-app-state-v1'
const LAST_SYNC_KEY = 'lifeos-last-sync-time'
const SYNC_INTERVAL_ACTIVE = 15000
const SYNC_INTERVAL_HIDDEN = 45000
const AUTO_REFRESH_COOLDOWN = 5000
const LOCAL_RETRY_DELAY = 10000
const MAX_LOCAL_RETRY_ATTEMPTS = 6
const MAX_RETRY_DELAY = 120000

const initialState = {
  finance: { expenses: [], budgets: {}, categories: [], bills: [] },
  timeflow: { entries: [] },
  study: { sessions: [], goals: {}, subjects: [] },
  habits: { checkpoints: [], dailyLogs: [] },
  health: { imported: {}, manualLogs: [] },
  journal: { entries: [] },
  settings: {
    profile: {
      name: 'Ravish',
      avatar: '🧠',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    },
    preferences: {
      dailyStudyGoal: 6,
      monthlyBudget: 15000,
      dailyWasteLimit: 2,
      sleepGoal: 8,
      dailyStepGoal: 10000,
      theme: 'dark',
      geminiApiKey: '',
      notificationsEnabled: true,
      dailyCheckinReminder: '21:00',
      budgetAlertAt: 80,
      streakRiskWarning: true,
      weeklyReportDay: 'Sunday',
      expenseCategories: [
        'Food',
        'Drinks',
        'Groceries',
        'Transport',
        'Gym Fitness',
        'Study Education',
        'Shopping',
        'Bills Utilities',
        'Health Medical',
        'Entertainment',
        'Subscriptions',
        'Travel',
        'Personal Care',
        'Gifts',
        'Miscellaneous',
      ],
      timeCategories: [
        'Sleep',
        'Morning Routine',
        'Exercise',
        'Study',
        'Deep Work',
        'Meals',
        'Social Media',
        'Entertainment',
        'Travel',
        'Self-Care',
        'Waste Time',
        'Other',
      ],
    },
  },
  aiChat: { messages: [] },
  syncStatus: 'idle',
  lastSynced: null,
  lastRemoteModified: null,
  remoteMetadata: {},
  hydrated: false,
  isFromDrive: false, // Track if data came from Google Drive
}

const MODULE_FILE_MAP = {
  finance: 'finance.json',
  timeflow: 'timeflow.json',
  study: 'study.json',
  habits: 'habits.json',
  health: 'health.json',
  journal: 'journal.json',
  settings: 'settings.json',
  aiChat: 'aiChat.json',
}

function sanitizeModuleForPersist(module, data) {
  if (!data) return data

  if (module === 'settings') {
    return stripGeminiKeyFromSettings(data)
  }

  if (module === 'finance') {
    return {
      ...data,
      bills: (data.bills || []).map((bill) => {
        const safeBill = { ...bill }
        delete safeBill.base64
        return safeBill
      }),
      expenses: (data.expenses || []).map((expense) => {
        const safeExpense = { ...expense }
        delete safeExpense.billImageBase64
        return safeExpense
      }),
    }
  }

  return data
}

function sanitizeStateForStorage(appState) {
  return {
    ...appState,
    settings: stripGeminiKeyFromSettings(appState.settings),
    finance: sanitizeModuleForPersist('finance', appState.finance),
  }
}

function buildSampleState() {
  return {
    ...initialState,
    finance: {
      expenses: sampleExpenses || [],
      budgets: { monthly: sampleSettings?.monthlyBudget || 8000 },
      categories:
        sampleSettings?.categories?.expense ||
        initialState.settings.preferences.expenseCategories,
      bills: [],
    },
    study: {
      sessions: sampleSessions || [],
      goals: { dailyHours: 6 },
      subjects: ['Machine Learning', 'DSA', 'Deep RL'],
    },
    habits: {
      checkpoints: sampleCheckpoints || [],
      dailyLogs: sampleHabitLogs || [],
    },
    timeflow: {
      entries: sampleTimeEntries || [],
    },
    journal: {
      entries: sampleJournal || [],
    },
    health: {
      imported: {},
      manualLogs: sampleHealthLogs || [],
    },
    settings: {
      ...initialState.settings,
      ...sampleSettings,
      profile: {
        ...initialState.settings.profile,
        ...(sampleSettings?.profile || {}),
      },
      preferences: {
        ...initialState.settings.preferences,
        ...(sampleSettings?.preferences || {}),
      },
    },
    syncStatus: 'synced',
    lastSynced: new Date().toISOString(),
    lastRemoteModified: null,
    remoteMetadata: {},
    hydrated: true,
    isFromDrive: false,
  }
}

function buildClearedState() {
  return {
    ...mergeWithInitialState(),
    syncStatus: 'synced',
    lastSynced: new Date().toISOString(),
    lastRemoteModified: null,
    remoteMetadata: {},
    hydrated: true,
    isFromDrive: false,
  }
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function arrayOrFallback(value, fallback) {
  return Array.isArray(value) ? value : fallback
}

function mergeWithInitialState(data = {}) {
  const safeData = asPlainObject(data)
  const finance = asPlainObject(safeData.finance)
  const timeflow = asPlainObject(safeData.timeflow)
  const study = asPlainObject(safeData.study)
  const habits = asPlainObject(safeData.habits)
  const health = asPlainObject(safeData.health)
  const journal = asPlainObject(safeData.journal)
  const settings = asPlainObject(safeData.settings)
  const preferences = asPlainObject(settings.preferences)
  const aiChat = asPlainObject(safeData.aiChat)

  return {
    ...initialState,
    ...safeData,
    finance: {
      ...initialState.finance,
      ...finance,
      expenses: asArray(finance.expenses),
      budgets: asPlainObject(finance.budgets),
      categories: asArray(finance.categories),
      bills: asArray(finance.bills),
    },
    timeflow: {
      ...initialState.timeflow,
      ...timeflow,
      entries: asArray(timeflow.entries),
    },
    study: {
      ...initialState.study,
      ...study,
      sessions: asArray(study.sessions),
      goals: asPlainObject(study.goals),
      subjects: asArray(study.subjects),
    },
    habits: {
      ...initialState.habits,
      ...habits,
      checkpoints: asArray(habits.checkpoints),
      dailyLogs: asArray(habits.dailyLogs),
    },
    health: {
      ...initialState.health,
      ...health,
      imported: asPlainObject(health.imported),
      manualLogs: asArray(health.manualLogs),
      bodyLogs: asArray(health.bodyLogs),
      nutrition: asArray(health.nutrition),
      hevyWorkouts: asArray(health.hevyWorkouts),
    },
    journal: {
      ...initialState.journal,
      ...journal,
      entries: asArray(journal.entries),
    },
    settings: {
      profile: {
        ...initialState.settings.profile,
        ...asPlainObject(settings.profile),
      },
      preferences: {
        ...initialState.settings.preferences,
        ...preferences,
        expenseCategories: arrayOrFallback(
          preferences.expenseCategories,
          initialState.settings.preferences.expenseCategories
        ),
        timeCategories: arrayOrFallback(
          preferences.timeCategories,
          initialState.settings.preferences.timeCategories
        ),
      },
    },
    aiChat: {
      ...initialState.aiChat,
      ...aiChat,
      messages: asArray(aiChat.messages),
    },
    lastRemoteModified: safeData.lastRemoteModified || null,
    remoteMetadata: asPlainObject(safeData.remoteMetadata),
  }
}

function driveDataToAppState(files) {
  return mergeWithInitialState({
    finance: files['finance.json'],
    timeflow: files['timeflow.json'],
    study: files['study.json'],
    habits: files['habits.json'],
    health: files['health.json'],
    journal: files['journal.json'],
    settings: files['settings.json'],
    aiChat: files['aiChat.json'],
  })
}

function syncResultToAppState(syncResult) {
  return {
    ...driveDataToAppState(syncResult.files),
    remoteMetadata: syncResult.metadata || {},
    lastRemoteModified: syncResult.latestRemoteModified || null,
  }
}

function hasRemoteStateChanged(remoteMetadata = {}, currentMetadata = {}) {
  const fileNames = Object.values(MODULE_FILE_MAP)

  return fileNames.some(fileName => {
    const remote = remoteMetadata[fileName] || null
    const current = currentMetadata[fileName] || null

    if (!remote && !current) return false
    if (!remote || !current) return true

    return (
      remote.id !== current.id ||
      (remote.modifiedTime || '') !== (current.modifiedTime || '')
    )
  })
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE_STATE':
      return {
        ...state,
        ...action.data,
        hydrated: true,
      }

    case 'SET_MODULE':
      return {
        ...state,
        [action.module]: action.data,
        syncStatus: action.syncStatus || 'synced',
        lastSynced: action.time || new Date().toISOString(),
      }

    case 'PATCH_MODULE':
      return {
        ...state,
        [action.module]: {
          ...state[action.module],
          ...action.data,
        },
        syncStatus: action.syncStatus || 'synced',
        lastSynced: action.time || new Date().toISOString(),
      }

    case 'SET_SYNC_STATUS':
      return {
        ...state,
        syncStatus: action.status,
        lastSynced: action.time || state.lastSynced,
      }

    case 'SET_REMOTE_METADATA':
      return {
        ...state,
        remoteMetadata: {
          ...state.remoteMetadata,
          [action.fileName]: {
            ...(state.remoteMetadata[action.fileName] || {}),
            ...(action.metadata || {}),
          },
        },
        lastRemoteModified:
          action.metadata?.modifiedTime || state.lastRemoteModified,
        syncStatus: action.syncStatus || state.syncStatus,
        lastSynced: action.time || state.lastSynced,
      }

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: {
          profile: {
            ...state.settings.profile,
            ...(action.data.profile || {}),
          },
          preferences: {
            ...state.settings.preferences,
            ...(action.data.preferences || {}),
          },
        },
        syncStatus: action.syncStatus || 'synced',
        lastSynced: action.time || new Date().toISOString(),
      }

    case 'RESET_TO_SAMPLE':
      return buildClearedState()

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const { isAuthReady, isAuthenticated } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const latestStateRef = useRef(state)
  const remoteMetadataRef = useRef(state.remoteMetadata)
  const syncIntervalRef = useRef(null)
  const syncInFlightRef = useRef(false)
  const retryTimeoutRef = useRef(null)
  const localSaveTimeoutRef = useRef(null)
  const retryAttemptRef = useRef(0)
  const lastAutoRefreshRef = useRef(0)
  const localFallbackPendingRef = useRef(false)
  const authWarningShownRef = useRef(false)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  useEffect(() => {
    remoteMetadataRef.current = state.remoteMetadata
  }, [state.remoteMetadata])

  useEffect(() => {
    if (isAuthenticated && getAccessToken()) {
      authWarningShownRef.current = false
    }
  }, [isAuthenticated])

  const isDriveAuthError = useCallback((error) => {
    const message = error?.message || ''
    return message.includes('Drive request failed: 401') || message.includes('Drive request failed: 403')
  }, [])

  const notifyDriveAuthNeeded = useCallback(() => {
    if (authWarningShownRef.current) return
    authWarningShownRef.current = true
    dispatch({ type: 'SET_SYNC_STATUS', status: 'auth_required' })
    console.warn('Google Drive session expired. Please sign out and sign in again to continue sync.')
  }, [])

  const applyDriveSyncResult = useCallback((syncResult) => {
    const mergedDriveState = syncResultToAppState(syncResult)
    const syncTime = syncResult.latestRemoteModified || new Date().toISOString()

    dispatch({
      type: 'HYDRATE_STATE',
      data: {
        ...mergedDriveState,
        syncStatus: 'synced',
        lastSynced: syncTime,
        hydrated: true,
        isFromDrive: true,
      },
    })
    localStorage.setItem(LAST_SYNC_KEY, syncTime)
    localFallbackPendingRef.current = false
    retryAttemptRef.current = 0
    authWarningShownRef.current = false
  }, [])

  const performDrivePull = useCallback(
    async ({ markSyncing = true, ensureFiles = true, forceApply = false } = {}) => {
      const token = getAccessToken()
      if (!token) {
        if (isAuthenticated) {
          notifyDriveAuthNeeded()
        } else {
          dispatch({ type: 'SET_SYNC_STATUS', status: 'offline' })
        }
        return null
      }

      if (syncInFlightRef.current) return null
      syncInFlightRef.current = true

      if (markSyncing) {
        dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })
      }

      try {
        if (ensureFiles) {
          await ensureInitialFiles()
        }
        const syncResult = await syncAll()
        const hasChanges = hasRemoteStateChanged(syncResult.metadata, remoteMetadataRef.current)

        if (!forceApply && !hasChanges) {
          dispatch({
            type: 'SET_SYNC_STATUS',
            status: navigator.onLine ? 'synced' : 'offline',
          })
          return syncResult
        }

        applyDriveSyncResult(syncResult)
        return syncResult
      } finally {
        syncInFlightRef.current = false
      }
    },
    [applyDriveSyncResult, isAuthenticated, notifyDriveAuthNeeded]
  )

  useEffect(() => {
    let cancelled = false

    async function hydrateApp() {
      try {
        if (!isAuthReady) return
        if (!cancelled) dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })

        if (isAuthenticated && getAccessToken()) {
          try {
            await performDrivePull({ markSyncing: false, ensureFiles: true, forceApply: true })
            return
          } catch (driveError) {
            console.warn('Drive sync failed, falling back to local cache:', driveError)
            if (isDriveAuthError(driveError)) {
              notifyDriveAuthNeeded()
            }
            localFallbackPendingRef.current = true
          }
        }

        // Fallback to localStorage only if Drive sync failed or no token
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) {
            const localData = JSON.parse(raw)
            if (!cancelled) {
              dispatch({
                type: 'HYDRATE_STATE',
                data: {
                  ...mergeWithInitialState(localData),
                  syncStatus: 'offline',
                  hydrated: true,
                  isFromDrive: false,
                },
              })
            }
            if (isAuthenticated && getAccessToken()) {
              localFallbackPendingRef.current = true
            }
          } else {
            throw new Error('No local data')
          }
        } catch {
          if (!cancelled) {
            dispatch({
              type: 'HYDRATE_STATE',
              data: {
                ...buildSampleState(),
                syncStatus: 'offline',
                hydrated: true,
                isFromDrive: false,
              },
            })
          }
          if (isAuthenticated && getAccessToken()) {
            localFallbackPendingRef.current = true
          }
        }
      } catch (error) {
        console.error('Fatal app initialization error:', error)
        if (!cancelled) {
          dispatch({
            type: 'HYDRATE_STATE',
            data: {
              ...buildSampleState(),
              syncStatus: 'offline',
              hydrated: true,
              isFromDrive: false,
            },
          })
        }
        if (isAuthenticated && getAccessToken()) {
          localFallbackPendingRef.current = true
        }
      }
    }

    hydrateApp()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isAuthReady, isDriveAuthError, notifyDriveAuthNeeded, performDrivePull])

  // Periodic sync for cross-device updates, adaptive to tab visibility
  useEffect(() => {
    if (!state.hydrated || !isAuthReady || !isAuthenticated) return
    if (!getAccessToken()) return

    const runPeriodicSync = () => {
      performDrivePull({ markSyncing: false, ensureFiles: false, forceApply: false }).catch(error => {
        console.error('Periodic sync failed:', error)
        if (isDriveAuthError(error)) {
          notifyDriveAuthNeeded()
          return
        }
        dispatch({
          type: 'SET_SYNC_STATUS',
          status: navigator.onLine ? 'idle' : 'offline',
        })
      })
    }

    const restartInterval = () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
      const delay =
        document.visibilityState === 'visible'
          ? SYNC_INTERVAL_ACTIVE
          : SYNC_INTERVAL_HIDDEN
      syncIntervalRef.current = setInterval(runPeriodicSync, delay)
    }

    restartInterval()
    document.addEventListener('visibilitychange', restartInterval)

    return () => {
      document.removeEventListener('visibilitychange', restartInterval)
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [isAuthenticated, isAuthReady, isDriveAuthError, notifyDriveAuthNeeded, performDrivePull, state.hydrated])

  // Immediate auto refresh on foreground/online/login transitions
  useEffect(() => {
    if (!state.hydrated || !isAuthReady || !isAuthenticated) return
    if (!getAccessToken()) return

    const triggerAutoRefresh = () => {
      const now = Date.now()
      if (now - lastAutoRefreshRef.current < AUTO_REFRESH_COOLDOWN) return
      lastAutoRefreshRef.current = now

      performDrivePull({ markSyncing: false, ensureFiles: true, forceApply: true }).catch(error => {
        console.error('Auto refresh failed:', error)
        if (isDriveAuthError(error)) {
          notifyDriveAuthNeeded()
          return
        }
        dispatch({
          type: 'SET_SYNC_STATUS',
          status: navigator.onLine ? 'idle' : 'offline',
        })
      })
    }

    triggerAutoRefresh()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerAutoRefresh()
      }
    }

    window.addEventListener('focus', triggerAutoRefresh)
    window.addEventListener('online', triggerAutoRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', triggerAutoRefresh)
      window.removeEventListener('online', triggerAutoRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, isAuthReady, isDriveAuthError, notifyDriveAuthNeeded, performDrivePull, state.hydrated])

  // Retry pull automatically after local fallback
  useEffect(() => {
    if (!state.hydrated || !isAuthReady || !isAuthenticated) return
    if (state.syncStatus === 'auth_required') return
    if (!localFallbackPendingRef.current || !navigator.onLine || !getAccessToken()) return

    const scheduleRetry = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }

      const attempt = retryAttemptRef.current
      if (attempt >= MAX_LOCAL_RETRY_ATTEMPTS) {
        console.warn('Stopping automatic retry after max attempts. Manual refresh may be needed.')
        dispatch({
          type: 'SET_SYNC_STATUS',
          status: navigator.onLine ? 'idle' : 'offline',
        })
        return
      }

      const delay = Math.min(LOCAL_RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY)

      retryTimeoutRef.current = setTimeout(() => {
        performDrivePull({ markSyncing: true, ensureFiles: true, forceApply: true }).catch(error => {
          console.error('Retry sync failed:', error)
          if (isDriveAuthError(error)) {
            notifyDriveAuthNeeded()
            return
          }
          retryAttemptRef.current += 1
          if (localFallbackPendingRef.current) {
            scheduleRetry()
          }
        })
      }, delay)
    }

    scheduleRetry()

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [isAuthenticated, isAuthReady, isDriveAuthError, notifyDriveAuthNeeded, performDrivePull, state.hydrated, state.syncStatus])

  // Auto-save to localStorage (fallback only)
  useEffect(() => {
    if (!state.hydrated) return
    if (localSaveTimeoutRef.current) {
      clearTimeout(localSaveTimeoutRef.current)
    }

    localSaveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStateForStorage(latestStateRef.current)))
      } catch (error) {
        console.error('Failed to save app state to localStorage:', error)
      }
    }, 300)

    return () => {
      if (localSaveTimeoutRef.current) {
        clearTimeout(localSaveTimeoutRef.current)
        localSaveTimeoutRef.current = null
      }
    }
  }, [state])

  useEffect(() => () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStateForStorage(latestStateRef.current)))
    } catch (error) {
      console.error('Failed to save app state to localStorage:', error)
    }
  }, [])

  const actions = useMemo(() => {
    const persistModule = (module, data) => {
      const fileName = MODULE_FILE_MAP[module]
      if (!fileName) return

      const payload = sanitizeModuleForPersist(module, data)

      dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })
      autoSave(fileName, payload, 1000)
        .then(result => {
          const syncTime = result?.modifiedTime || new Date().toISOString()
          dispatch({
            type: 'SET_REMOTE_METADATA',
            fileName,
            metadata: {
              id: result?.id || null,
              name: fileName,
              modifiedTime: result?.modifiedTime || null,
            },
            syncStatus: navigator.onLine ? 'synced' : 'offline',
            time: syncTime,
          })
          localStorage.setItem(LAST_SYNC_KEY, syncTime)
          authWarningShownRef.current = false
        })
        .catch(error => {
          console.error(`Failed scheduling auto-save for ${module}:`, error)
          if (isDriveAuthError(error)) {
            notifyDriveAuthNeeded()
            localFallbackPendingRef.current = true
          }
          dispatch({
            type: 'SET_SYNC_STATUS',
            status: navigator.onLine ? 'idle' : 'offline',
          })
        })
    }

    const setModule = (module, data) => {
      dispatch({
        type: 'SET_MODULE',
        module,
        data,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time: new Date().toISOString(),
      })
      persistModule(module, data)
    }

    const patchModule = (module, data) => {
      const currentState = latestStateRef.current
      const nextData = {
        ...currentState[module],
        ...data,
      }

      dispatch({
        type: 'PATCH_MODULE',
        module,
        data,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time: new Date().toISOString(),
      })
      persistModule(module, nextData)
    }

    const setSyncStatus = (status, time) =>
      dispatch({ type: 'SET_SYNC_STATUS', status, time })

    const setSettings = (data) => {
      const currentSettings = latestStateRef.current.settings
      const nextSettings = {
        profile: {
          ...currentSettings.profile,
          ...(data.profile || {}),
        },
        preferences: {
          ...currentSettings.preferences,
          ...(data.preferences || {}),
        },
      }

      dispatch({
        type: 'SET_SETTINGS',
        data,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time: new Date().toISOString(),
      })
      persistModule('settings', nextSettings)
    }

    const resetToSample = async () => {
      const token = getAccessToken()
      dispatch({ type: 'RESET_TO_SAMPLE' })

      try {
        if (token) {
          await deleteAllFiles()
        }
      } catch (error) {
        console.error('Failed to delete from Google Drive:', error)
      }

      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LAST_SYNC_KEY)
      clearDriveCache()

      if (token) {
        const emptyState = buildClearedState()
        let recreateFailures = 0
        await Promise.all(
          Object.entries(MODULE_FILE_MAP).map(async ([module, fileName]) => {
            try {
              const result = await autoSave(fileName, emptyState[module], 0)
              dispatch({
                type: 'SET_REMOTE_METADATA',
                fileName,
                metadata: {
                  id: result?.id || null,
                  name: fileName,
                  modifiedTime: result?.modifiedTime || null,
                },
                syncStatus: navigator.onLine ? 'synced' : 'offline',
                time: result?.modifiedTime || new Date().toISOString(),
              })
            } catch (error) {
              recreateFailures += 1
              console.error(
                `Failed to recreate ${module} after delete all: ${error?.message || 'unknown error'}`,
                error
              )
            }
          })
        )

        if (recreateFailures > 0) {
          console.warn(
            `Delete-all recreation completed with ${recreateFailures} failed module(s).`
          )
          dispatch({
            type: 'SET_SYNC_STATUS',
            status: navigator.onLine ? 'idle' : 'offline',
          })
        }

        try {
          await performDrivePull({ markSyncing: true, ensureFiles: false, forceApply: true })
        } catch (error) {
          console.error('Failed pull-confirm after delete all:', error)
          if (isDriveAuthError(error)) {
            notifyDriveAuthNeeded()
          } else {
            dispatch({
              type: 'SET_SYNC_STATUS',
              status: navigator.onLine ? 'idle' : 'offline',
            })
          }
        }
      }
    }

    const refreshFromDrive = async () => {
      try {
        await performDrivePull({ markSyncing: true, ensureFiles: true, forceApply: true })
      } catch (error) {
        console.error('Manual refresh failed:', error)
        if (isDriveAuthError(error)) {
          notifyDriveAuthNeeded()
        }
        dispatch({
          type: 'SET_SYNC_STATUS',
          status: navigator.onLine ? 'idle' : 'offline',
        })
      }
    }

    return {
      setModule,
      patchModule,
      setSyncStatus,
      setSettings,
      resetToSample,
      refreshFromDrive,
    }
  }, [isDriveAuthError, notifyDriveAuthNeeded, performDrivePull])

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>
        {children}
      </AppActionsContext.Provider>
    </AppStateContext.Provider>
  )
}
