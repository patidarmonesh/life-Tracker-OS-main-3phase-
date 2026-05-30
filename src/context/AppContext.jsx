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
import { useToast } from './ToastContext'

const STORAGE_KEY = 'lifeos-app-state-v1'
const MODULE_STORAGE_PREFIX = 'lifeos-module-state-v1:'
const LOCAL_META_KEY = 'lifeos-local-meta-v1'
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

const RECORD_COLLECTIONS_BY_MODULE = {
  finance: ['expenses', 'bills'],
  timeflow: ['entries'],
  study: ['sessions'],
  habits: ['checkpoints', 'dailyLogs'],
  health: ['manualLogs', 'bodyLogs', 'nutrition', 'hevyWorkouts'],
  journal: ['entries'],
  aiChat: ['messages'],
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

function getModuleStorageKey(module) {
  return `${MODULE_STORAGE_PREFIX}${module}`
}

function buildLocalMeta(appState) {
  return {
    lastSynced: appState.lastSynced || null,
    lastRemoteModified: appState.lastRemoteModified || null,
    remoteMetadata: appState.remoteMetadata || {},
    isFromDrive: !!appState.isFromDrive,
  }
}

function saveLocalMetaToStorage(appState) {
  localStorage.setItem(LOCAL_META_KEY, JSON.stringify(buildLocalMeta(appState)))
}

function saveModuleToLocalStorage(module, data) {
  localStorage.setItem(
    getModuleStorageKey(module),
    JSON.stringify(sanitizeModuleForPersist(module, data))
  )
}

function loadStateFromLocalStorage() {
  let hasModuleData = false
  const moduleData = {}

  Object.keys(MODULE_FILE_MAP).forEach(module => {
    const raw = localStorage.getItem(getModuleStorageKey(module))
    if (!raw) return
    moduleData[module] = JSON.parse(raw)
    hasModuleData = true
  })

  if (hasModuleData) {
    const rawMeta = localStorage.getItem(LOCAL_META_KEY)
    const meta = rawMeta ? JSON.parse(rawMeta) : {}
    return mergeWithInitialState({ ...meta, ...moduleData })
  }

  const legacyRaw = localStorage.getItem(STORAGE_KEY)
  return legacyRaw ? mergeWithInitialState(JSON.parse(legacyRaw)) : null
}

function clearLocalStorageState() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LOCAL_META_KEY)
  Object.keys(MODULE_FILE_MAP).forEach(module => {
    localStorage.removeItem(getModuleStorageKey(module))
  })
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

function getRecordTime(record = {}) {
  const value =
    record.deletedAt ||
    record.updatedAt ||
    record.createdAt ||
    record.loggedAt ||
    record.uploadedAt ||
    record.date ||
    ''
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

function getDeletedMap(moduleData = {}, collection) {
  const deleted = asPlainObject(moduleData._deleted)
  return asPlainObject(deleted[collection])
}

function mergeDeletedMaps(localMap = {}, remoteMap = {}) {
  const merged = { ...remoteMap }

  Object.entries(localMap).forEach(([id, localDeleted]) => {
    const remoteDeleted = merged[id]
    if (!remoteDeleted || getRecordTime(localDeleted) >= getRecordTime(remoteDeleted)) {
      merged[id] = localDeleted
    }
  })

  return merged
}

function mergeRecordCollections(localRecords = [], remoteRecords = [], deletedMap = {}) {
  const byId = new Map()
  const withoutIds = []

  ;[...localRecords, ...remoteRecords].forEach(record => {
    if (!record || typeof record !== 'object') return

    if (!record.id) {
      withoutIds.push(record)
      return
    }

    const existing = byId.get(record.id)
    if (!existing || getRecordTime(record) >= getRecordTime(existing)) {
      byId.set(record.id, record)
    }
  })

  const mergedRecords = Array.from(byId.values()).filter(record => {
    const deleted = deletedMap[record.id]
    return !deleted || getRecordTime(record) > getRecordTime(deleted)
  })

  return [...mergedRecords, ...withoutIds]
}

function mergeModuleRecords(module, localModule = {}, remoteModule = {}) {
  const collections = RECORD_COLLECTIONS_BY_MODULE[module]
  if (!collections) return remoteModule ?? localModule

  const local = asPlainObject(localModule)
  const remote = asPlainObject(remoteModule)
  const nextDeleted = {}
  const merged = {
    ...local,
    ...remote,
  }

  collections.forEach(collection => {
    const deletedMap = mergeDeletedMaps(
      getDeletedMap(local, collection),
      getDeletedMap(remote, collection)
    )

    const records = mergeRecordCollections(
      asArray(local[collection]),
      asArray(remote[collection]),
      deletedMap
    )

    merged[collection] = records

    const activeRecordIds = new Set(records.map(record => record?.id).filter(Boolean))
    const remainingDeleted = Object.fromEntries(
      Object.entries(deletedMap).filter(([id]) => !activeRecordIds.has(id))
    )

    if (Object.keys(remainingDeleted).length) {
      nextDeleted[collection] = remainingDeleted
    }
  })

  if (Object.keys(nextDeleted).length) {
    merged._deleted = nextDeleted
  } else {
    delete merged._deleted
  }

  return merged
}

function addDeletedRecords(module, previousData = {}, nextData = {}) {
  const collections = RECORD_COLLECTIONS_BY_MODULE[module]
  if (!collections) return nextData

  const deletedAt = new Date().toISOString()
  const nextDeleted = { ...asPlainObject(nextData._deleted) }
  let preparedData = nextData
  let changed = false

  collections.forEach(collection => {
    const previousRecords = asArray(previousData[collection])
    const nextRecords = asArray(nextData[collection])
    const nextIds = new Set(nextRecords.map(record => record?.id).filter(Boolean))
    const collectionDeleted = { ...asPlainObject(nextDeleted[collection]) }

    previousRecords.forEach(record => {
      if (!record?.id || nextIds.has(record.id)) return
      collectionDeleted[record.id] = { id: record.id, deletedAt }
      changed = true
    })

    nextIds.forEach(id => {
      if (collectionDeleted[id]) {
        delete collectionDeleted[id]
        preparedData = {
          ...preparedData,
          [collection]: asArray(preparedData[collection]).map(record =>
            record?.id === id
              ? { ...record, updatedAt: deletedAt }
              : record
          ),
        }
        changed = true
      }
    })

    if (Object.keys(collectionDeleted).length) {
      nextDeleted[collection] = collectionDeleted
    } else {
      delete nextDeleted[collection]
    }
  })

  if (!changed) return nextData

  if (!Object.keys(nextDeleted).length) {
    const cleanData = { ...preparedData }
    delete cleanData._deleted
    return cleanData
  }

  return {
    ...preparedData,
    _deleted: nextDeleted,
  }
}

function modulesAreEqual(module, a, b) {
  return (
    JSON.stringify(sanitizeModuleForPersist(module, a)) ===
    JSON.stringify(sanitizeModuleForPersist(module, b))
  )
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

function driveDataToAppState(files = {}, baseState = {}, { mergeLocalRecords = true } = {}) {
  const data = {
    ...baseState,
  }
  const dirtyModules = []

  Object.entries(MODULE_FILE_MAP).forEach(([module, fileName]) => {
    if (!(fileName in files)) {
      data[module] = baseState[module]
      return
    }

    const remoteModule = files[fileName]
    data[module] = mergeLocalRecords && RECORD_COLLECTIONS_BY_MODULE[module]
      ? mergeModuleRecords(module, baseState[module], remoteModule)
      : remoteModule
  })

  const appState = mergeWithInitialState(data)

  Object.entries(MODULE_FILE_MAP).forEach(([module, fileName]) => {
    if (!(fileName in files)) return
    if (!modulesAreEqual(module, appState[module], files[fileName])) {
      dirtyModules.push(module)
    }
  })

  return { appState, dirtyModules }
}

function syncResultToAppState(syncResult, baseState = {}, options = {}) {
  const { appState, dirtyModules } = driveDataToAppState(syncResult.files, baseState, options)

  return {
    appState: {
      ...appState,
      remoteMetadata: syncResult.metadata || {},
      lastRemoteModified: syncResult.latestRemoteModified || null,
    },
    dirtyModules,
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
  const { showToast } = useToast()
  const [state, dispatch] = useReducer(reducer, initialState)
  const latestStateRef = useRef(state)
  const remoteMetadataRef = useRef(state.remoteMetadata)
  const syncIntervalRef = useRef(null)
  const syncInFlightRef = useRef(false)
  const retryTimeoutRef = useRef(null)
  const retryAttemptRef = useRef(0)
  const lastAutoRefreshRef = useRef(0)
  const localFallbackPendingRef = useRef(false)
  const authWarningShownRef = useRef(false)
  const localStorageWarningShownRef = useRef(false)
  const lastLocalModuleJsonRef = useRef({})
  const lastDrivePayloadJsonRef = useRef({})

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

  const notifyLocalStorageFailure = useCallback((error) => {
    console.error('Failed to save local backup:', error)
    if (localStorageWarningShownRef.current) return
    localStorageWarningShownRef.current = true
    showToast('Local backup failed. Browser storage may be full.', 'error', {
      duration: 6000,
    })
  }, [showToast])

  const persistLastSyncTime = useCallback((time) => {
    try {
      localStorage.setItem(LAST_SYNC_KEY, time)
    } catch (error) {
      notifyLocalStorageFailure(error)
    }
  }, [notifyLocalStorageFailure])

  const persistLocalMeta = useCallback((appState) => {
    try {
      saveLocalMetaToStorage(appState)
    } catch (error) {
      notifyLocalStorageFailure(error)
    }
  }, [notifyLocalStorageFailure])

  const persistLocalModules = useCallback((modules, appState) => {
    try {
      modules.forEach(module => {
        const moduleData = appState[module]
        const json = JSON.stringify(sanitizeModuleForPersist(module, moduleData))
        if (lastLocalModuleJsonRef.current[module] === json) return
        saveModuleToLocalStorage(module, moduleData)
        lastLocalModuleJsonRef.current[module] = json
      })
      saveLocalMetaToStorage(appState)
    } catch (error) {
      notifyLocalStorageFailure(error)
    }
  }, [notifyLocalStorageFailure])

  const applyDriveSyncResult = useCallback((syncResult, { mergeLocalRecords = true } = {}) => {
    const { appState: mergedDriveState, dirtyModules } = syncResultToAppState(
      syncResult,
      mergeLocalRecords ? latestStateRef.current : initialState,
      { mergeLocalRecords }
    )
    const syncTime = syncResult.latestRemoteModified || new Date().toISOString()
    const downloadedModules = Object.entries(MODULE_FILE_MAP)
      .filter(([, fileName]) => fileName in (syncResult.files || {}))
      .map(([module]) => module)
    const dirtyModuleSet = new Set(dirtyModules)

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
    persistLastSyncTime(syncTime)
    persistLocalModules(downloadedModules, {
      ...mergedDriveState,
      syncStatus: 'synced',
      lastSynced: syncTime,
      hydrated: true,
      isFromDrive: true,
    })

    Object.entries(MODULE_FILE_MAP).forEach(([module, fileName]) => {
      if (!(fileName in (syncResult.files || {}))) return
      if (dirtyModuleSet.has(module)) return
      lastDrivePayloadJsonRef.current[fileName] = JSON.stringify(
        sanitizeModuleForPersist(module, mergedDriveState[module])
      )
    })

    localFallbackPendingRef.current = false
    retryAttemptRef.current = 0
    authWarningShownRef.current = false

    if (dirtyModules.length) {
      dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })

      dirtyModules.forEach(module => {
        const fileName = MODULE_FILE_MAP[module]
        const payload = sanitizeModuleForPersist(module, mergedDriveState[module])

        autoSave(fileName, payload, 0)
          .then(result => {
            const repairedSyncTime = result?.modifiedTime || new Date().toISOString()
            lastDrivePayloadJsonRef.current[fileName] = JSON.stringify(payload)
            dispatch({
              type: 'SET_REMOTE_METADATA',
              fileName,
              metadata: {
                id: result?.id || null,
                name: fileName,
                modifiedTime: result?.modifiedTime || null,
              },
              syncStatus: navigator.onLine ? 'synced' : 'offline',
              time: repairedSyncTime,
            })
            persistLastSyncTime(repairedSyncTime)
          })
          .catch(error => {
            delete lastDrivePayloadJsonRef.current[fileName]
            console.error(`Failed to save merged ${module} sync state:`, error)
            if (isDriveAuthError(error)) {
              notifyDriveAuthNeeded()
              localFallbackPendingRef.current = true
              return
            }
            dispatch({
              type: 'SET_SYNC_STATUS',
              status: navigator.onLine ? 'idle' : 'offline',
            })
          })
      })
    }
  }, [
    isDriveAuthError,
    notifyDriveAuthNeeded,
    persistLastSyncTime,
    persistLocalModules,
  ])

  const performDrivePull = useCallback(
    async ({
      markSyncing = true,
      ensureFiles = true,
      forceApply = false,
      mergeLocalRecords = !forceApply,
    } = {}) => {
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
        const syncResult = await syncAll({
          currentMetadata: remoteMetadataRef.current,
          forceDownload: forceApply,
        })
        const hasChanges = hasRemoteStateChanged(syncResult.metadata, remoteMetadataRef.current)

        if (!forceApply && !hasChanges) {
          dispatch({
            type: 'SET_SYNC_STATUS',
            status: navigator.onLine ? 'synced' : 'offline',
          })
          return syncResult
        }

        applyDriveSyncResult(syncResult, { mergeLocalRecords })
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
        const hasDriveSession = isAuthenticated && getAccessToken()

        if (hasDriveSession) {
          if (!cancelled) {
            dispatch({
              type: 'HYDRATE_STATE',
              data: {
                ...mergeWithInitialState(),
                syncStatus: 'syncing',
                hydrated: true,
                isFromDrive: false,
              },
            })
          }

          performDrivePull({
            markSyncing: false,
            ensureFiles: true,
            forceApply: true,
            mergeLocalRecords: false,
          }).catch(driveError => {
            console.warn('Drive sync failed during hydrate:', driveError)
            if (isDriveAuthError(driveError)) {
              notifyDriveAuthNeeded()
              return
            }

            if (!cancelled) {
              dispatch({
                type: 'SET_SYNC_STATUS',
                status: navigator.onLine ? 'idle' : 'offline',
              })
            }

            localFallbackPendingRef.current = true
          })
          return
        }

        try {
          const localData = loadStateFromLocalStorage()
          if (localData) {
            if (!cancelled) {
              dispatch({
                type: 'HYDRATE_STATE',
                data: {
                  ...localData,
                  syncStatus: 'offline',
                  hydrated: true,
                  isFromDrive: false,
                },
              })
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

  // Keep lightweight sync metadata current locally; modules are saved at mutation/sync points.
  useEffect(() => {
    if (!state.hydrated) return
    persistLocalMeta(latestStateRef.current)
  }, [
    persistLocalMeta,
    state.hydrated,
    state.isFromDrive,
    state.lastRemoteModified,
    state.lastSynced,
    state.remoteMetadata,
  ])

  useEffect(() => () => {
    persistLocalMeta(latestStateRef.current)
  }, [persistLocalMeta])

  const actions = useMemo(() => {
    const persistModule = (module, data) => {
      const fileName = MODULE_FILE_MAP[module]
      if (!fileName) return

      const payload = sanitizeModuleForPersist(module, data)
      const payloadJson = JSON.stringify(payload)

      if (lastDrivePayloadJsonRef.current[fileName] === payloadJson) {
        return
      }

      lastDrivePayloadJsonRef.current[fileName] = payloadJson
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
          persistLastSyncTime(syncTime)
          authWarningShownRef.current = false
        })
        .catch(error => {
          delete lastDrivePayloadJsonRef.current[fileName]
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
      const time = new Date().toISOString()
      const nextData = addDeletedRecords(
        module,
        latestStateRef.current[module],
        data
      )
      const nextLocalState = {
        ...latestStateRef.current,
        [module]: nextData,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        lastSynced: time,
      }

      dispatch({
        type: 'SET_MODULE',
        module,
        data: nextData,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time,
      })
      persistLocalModules([module], nextLocalState)
      persistModule(module, nextData)
    }

    const patchModule = (module, data) => {
      const time = new Date().toISOString()
      const currentState = latestStateRef.current
      const nextData = addDeletedRecords(module, currentState[module], {
        ...currentState[module],
        ...data,
      })
      const nextLocalState = {
        ...currentState,
        [module]: nextData,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        lastSynced: time,
      }

      dispatch({
        type: 'SET_MODULE',
        module,
        data: nextData,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time,
      })
      persistLocalModules([module], nextLocalState)
      persistModule(module, nextData)
    }

    const setSyncStatus = (status, time) =>
      dispatch({ type: 'SET_SYNC_STATUS', status, time })

    const setSettings = (data) => {
      const time = new Date().toISOString()
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
      const nextLocalState = {
        ...latestStateRef.current,
        settings: nextSettings,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        lastSynced: time,
      }

      dispatch({
        type: 'SET_SETTINGS',
        data,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time,
      })
      persistLocalModules(['settings'], nextLocalState)
      persistModule('settings', nextSettings)
    }

    const resetToSample = async () => {
      const token = getAccessToken()
      const emptyState = buildClearedState()
      dispatch({ type: 'HYDRATE_STATE', data: emptyState })

      try {
        if (token) {
          await deleteAllFiles()
        }
      } catch (error) {
        console.error('Failed to delete from Google Drive:', error)
      }

      localStorage.removeItem(LAST_SYNC_KEY)
      clearLocalStorageState()
      clearDriveCache()
      persistLocalModules(Object.keys(MODULE_FILE_MAP), emptyState)

      if (token) {
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
  }, [
    isDriveAuthError,
    notifyDriveAuthNeeded,
    performDrivePull,
    persistLastSyncTime,
    persistLocalModules,
  ])

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>
        {children}
      </AppActionsContext.Provider>
    </AppStateContext.Provider>
  )
}
