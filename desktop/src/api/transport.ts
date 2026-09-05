import { isDesktopRuntime } from '@/lib/tauri'

/**
 * How HTTP leaves the app.
 *
 * A Tauri webview's origin is `tauri://localhost`, which the backend's CORS
 * allowlist does not (and should not) contain. The HTTP plugin performs the
 * request from Rust instead, where CORS does not apply — so the desktop build
 * never depends on the server allowlisting a client origin. In a plain browser
 * this falls back to `window.fetch`.
 *
 * Kept in its own module because both the API client and the token refresh
 * need it, and the refresh must not import the client.
 */
type FetchFn = typeof globalThis.fetch

let transportPromise: Promise<FetchFn> | null = null

const resolveTransport = async (): Promise<FetchFn> => {
  if (!isDesktopRuntime) return globalThis.fetch.bind(globalThis)
  const plugin = await import('@tauri-apps/plugin-http')
  return plugin.fetch as unknown as FetchFn
}

export const getTransport = (): Promise<FetchFn> => {
  transportPromise ??= resolveTransport()
  return transportPromise
}
