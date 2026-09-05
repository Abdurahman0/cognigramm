/**
 * Whether the renderer is inside a Tauri webview rather than a plain browser.
 *
 * Tauri 2 injects `__TAURI_INTERNALS__` before any app script runs, so this is
 * safe to read at module scope; `withGlobalTauri` is not required.
 */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Desktop-only chrome (custom title bar, tray hints) keys off this. */
export const isDesktopRuntime = isTauri()
