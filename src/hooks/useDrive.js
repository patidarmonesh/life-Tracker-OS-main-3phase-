import { useApp } from '../context/AppContext'

export function useDrive() {
  const { state, refreshFromDrive } = useApp()

  return {
    syncStatus: state.syncStatus,
    lastSynced: state.lastSynced,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    refresh: refreshFromDrive,
  }
}
