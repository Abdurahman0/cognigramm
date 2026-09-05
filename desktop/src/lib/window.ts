import { isDesktopRuntime } from '@/lib/tauri'

/**
 * Window controls for the custom title bar.
 *
 * `decorations: false` in tauri.conf.json means the OS draws no buttons, so
 * these are the only way to minimise, maximise or close. Each import is lazy
 * so the browser dev build never touches the Tauri API.
 */

const withWindow = async <T>(fn: (win: Awaited<ReturnType<typeof getWindow>>) => Promise<T>) => {
  if (!isDesktopRuntime) return undefined
  return fn(await getWindow())
}

const getWindow = async () => {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

export const minimizeWindow = (): Promise<unknown> => withWindow((win) => win.minimize())

export const toggleMaximizeWindow = (): Promise<unknown> =>
  withWindow((win) => win.toggleMaximize())

/**
 * Closing hides to the tray instead of quitting: a messenger that stops
 * receiving when its window is dismissed is a messenger people miss calls on.
 * Quit lives in the tray menu.
 */
export const closeWindow = (): Promise<unknown> => withWindow((win) => win.hide())

export const isMaximized = async (): Promise<boolean> =>
  (await withWindow((win) => win.isMaximized())) ?? false
