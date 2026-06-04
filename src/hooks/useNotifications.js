import { useEffect, useState } from 'react'

/**
 * Custom React Hook to manage local browser Web Notifications
 */
export function useNotifications() {
  const [permission, setPermission] = useState('default')

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  async function requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported'
    }
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result
    } catch (e) {
      return 'denied'
    }
  }

  function sendNotification(title, options = {}) {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }
    if (Notification.permission !== 'granted') {
      return false
    }

    try {
      const notification = new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        silent: false,
        ...options,
      })

      // Auto close notification after 5 seconds
      setTimeout(() => notification.close(), 5000)
      return true
    } catch (e) {
      console.error('Failed to dispatch Web Notification:', e)
      return false
    }
  }

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
  }
}
