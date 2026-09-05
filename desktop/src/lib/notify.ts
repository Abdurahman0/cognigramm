import { isDesktopRuntime } from '@/lib/tauri'

/**
 * OS notifications.
 *
 * Tauri routes these through the native centre (and keeps working when the
 * window is hidden to the tray), which the web Notification API in a webview
 * does not do reliably. The browser path exists so `pnpm dev` behaves.
 */

let permissionPromise: Promise<boolean> | null = null

const requestPermission = async (): Promise<boolean> => {
  if (isDesktopRuntime) {
    const { isPermissionGranted, requestPermission: ask } =
      await import('@tauri-apps/plugin-notification')
    if (await isPermissionGranted()) return true
    return (await ask()) === 'granted'
  }

  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export const ensureNotificationPermission = (): Promise<boolean> => {
  permissionPromise ??= requestPermission().catch(() => false)
  return permissionPromise
}

export interface DesktopNotification {
  title: string
  body: string
}

export const notify = async ({ title, body }: DesktopNotification): Promise<void> => {
  if (!(await ensureNotificationPermission())) return

  if (isDesktopRuntime) {
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    sendNotification({ title, body })
    return
  }

  if (typeof Notification !== 'undefined') {
    new Notification(title, { body })
  }
}

/** True when the window is focused, so a visible chat does not also ping. */
export const isWindowFocused = (): boolean =>
  typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()
