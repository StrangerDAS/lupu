/**
 * pushNotificationService.js
 * 
 * Manages Native Web Push Notifications for desktop (Mac/Windows/Linux) and mobile devices.
 * Features:
 * - Requests browser Notification permissions
 * - Shows native OS push notifications on new system events (bookings, approvals, messages)
 * - Tracks shown notification IDs to prevent duplicate desktop popups
 * - Plays subtle audio alert if configured
 */

let shownNotificationIds = new Set()

/**
 * Checks if native Web Notifications are supported in current browser
 */
export function isPushSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Gets current notification permission status ('granted' | 'denied' | 'default')
 */
export function getNotificationPermission() {
  if (!isPushSupported()) return 'denied'
  return Notification.permission
}

/**
 * Prompts user for native browser push notification permission
 */
export async function requestNotificationPermission() {
  if (!isPushSupported()) {
    console.warn('[PushNotification] Native Web Notifications are not supported in this browser.')
    return 'unsupported'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  try {
    const permission = await Notification.requestPermission()
    console.log(`[PushNotification] User response: ${permission}`)
    return permission
  } catch (err) {
    console.error('[PushNotification] Error requesting permission:', err)
    return 'denied'
  }
}

/**
 * Triggers a native OS push notification on user's laptop or mobile phone.
 * 
 * @param {Object} options
 * @param {string} options.id - Unique ID to prevent duplicate popups
 * @param {string} options.title - Notification title
 * @param {string} options.body - Body message
 * @param {string} [options.icon] - Optional icon URL
 * @param {string} [options.link] - URL path to navigate on click
 * @param {Function} [options.onClick] - Custom click handler
 */
export function triggerNativePush({ id, title, body, icon = '/logo-icon.svg', link = '/my-bookings', onClick }) {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return null
  }

  // Prevent duplicate push popups for the same notification ID
  if (id && shownNotificationIds.has(id)) {
    return null
  }

  if (id) {
    shownNotificationIds.add(id)
    // Limit memory set size
    if (shownNotificationIds.size > 200) {
      const firstItem = shownNotificationIds.values().next().value
      shownNotificationIds.delete(firstItem)
    }
  }

  try {
    const notification = new Notification(title || 'LUPU Alert', {
      body: body || 'You have a new update on LUPU.',
      icon: icon || '/logo-icon.svg',
      badge: '/logo-icon.svg',
      tag: id || undefined,
      renotify: true,
      requireInteraction: false,
    })

    notification.onclick = (event) => {
      event.preventDefault()
      window.focus()
      notification.close()

      if (onClick) {
        onClick()
      } else if (link) {
        window.location.href = link
      }
    }

    return notification
  } catch (err) {
    console.error('[PushNotification] Error displaying native notification:', err)
    return null
  }
}
