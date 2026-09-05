import { isDesktopRuntime } from '@/lib/tauri'

/**
 * Where the refresh token lives.
 *
 * A refresh token is a 180-day credential, so it must not sit in
 * `localStorage`, which every script in the webview can read. On the desktop
 * it goes through a Rust command that writes to the app's private data
 * directory with owner-only permissions; the webview can ask the backend to
 * store and fetch it, but cannot read the file.
 *
 * In a plain browser (`pnpm dev`) there is no such vault, so it falls back to
 * `localStorage` — acceptable only because that build talks to stubs.
 */

const FALLBACK_PREFIX = 'qq.secret.'

export const secureStore = {
  async set(key: string, value: string): Promise<void> {
    if (isDesktopRuntime) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('secret_set', { key, value })
      return
    }
    try {
      localStorage.setItem(`${FALLBACK_PREFIX}${key}`, value)
    } catch {
      // Private mode or blocked storage: the session simply will not survive
      // a restart, which is better than failing the login that produced it.
    }
  },

  async get(key: string): Promise<string | null> {
    if (isDesktopRuntime) {
      const { invoke } = await import('@tauri-apps/api/core')
      return (await invoke<string | null>('secret_get', { key })) ?? null
    }
    try {
      return localStorage.getItem(`${FALLBACK_PREFIX}${key}`)
    } catch {
      return null
    }
  },

  async clear(key: string): Promise<void> {
    if (isDesktopRuntime) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('secret_delete', { key })
      return
    }
    try {
      localStorage.removeItem(`${FALLBACK_PREFIX}${key}`)
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  },
}

/**
 * A human-readable name for this device, shown in the session list so a user
 * can tell which row to revoke.
 */
export const describeDevice = async (): Promise<string> => {
  if (isDesktopRuntime) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const name = await invoke<string>('device_name')
      if (name) return name
    } catch {
      // Fall through to the generic name below.
    }
    return 'Qora Qarga Desktop'
  }

  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const browser = /Firefox\/[\d.]+/.test(agent)
    ? 'Firefox'
    : /Edg\//.test(agent)
      ? 'Edge'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Browser'
  const platform = /Windows/.test(agent)
    ? 'Windows'
    : /Mac OS X/.test(agent)
      ? 'macOS'
      : /Linux/.test(agent)
        ? 'Linux'
        : 'Unknown OS'
  return `${browser} on ${platform}`
}
