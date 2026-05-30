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
    const { appState: mergedDriveState, dirtyModules } = syncResultToAppState(
      syncResult,
      latestStateRef.current
    )
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

    if (dirtyModules.length) {
      dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })

      dirtyModules.forEach(module => {
        const fileName = MODULE_FILE_MAP[module]
        const payload = sanitizeModuleForPersist(module, mergedDriveState[module])

        autoSave(fileName, payload, 0)
          .then(result => {
            const repairedSyncTime = result?.modifiedTime || new Date().toISOString()
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
            localStorage.setItem(LAST_SYNC_KEY, repairedSyncTime)
          })
          .catch(error => {
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
  }, [isDriveAuthError, notifyDriveAuthNeeded])

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
        const hasDriveSession = isAuthenticated && getAccessToken()
        let hydratedFromLocal = false

        try {
          const localData = loadStateFromLocalStorage()
          if (localData) {
            hydratedFromLocal = true
            if (!cancelled) {
              dispatch({
                type: 'HYDRATE_STATE',
                data: {
                  ...localData,
                  syncStatus: hasDriveSession ? 'syncing' : 'offline',
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
                syncStatus: hasDriveSession ? 'syncing' : 'offline',
                hydrated: true,
                isFromDrive: false,
              },
            })
          }
        }

        if (hasDriveSession) {
          localFallbackPendingRef.current = hydratedFromLocal

          performDrivePull({ markSyncing: false, ensureFiles: true, forceApply: true })
            .catch(driveError => {
              console.warn('Drive sync failed after local hydrate:', driveError)
              if (isDriveAuthError(driveError)) {
                notifyDriveAuthNeeded()
                return
              }
              dispatch({
                type: 'SET_SYNC_STATUS',
                status: navigator.onLine ? 'idle' : 'offline',
              })
              localFallbackPendingRef.current = true
            })
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
