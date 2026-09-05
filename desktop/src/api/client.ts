import { API_BASE_URL } from '@/lib/config'
import { isDesktopRuntime } from '@/lib/tauri'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  query?: Record<string, string | number | boolean | null | undefined>
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  /** Skip the Authorization header (login, register, health). */
  anonymous?: boolean
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  /** A 401 means the token is gone or expired; anything else is worth retrying. */
  get isAuthFailure(): boolean {
    return this.status === 401
  }
}

// ---------------------------------------------------------------------------
// Auth token
//
// Held in a module local rather than passed to every call: the store owns it,
// pushes it here on login/restore, and clears it on logout. That keeps the
// query layer free of token plumbing and gives the socket one place to read.
// ---------------------------------------------------------------------------
let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export const setAuthToken = (token: string | null): void => {
  authToken = token
}

export const getAuthToken = (): string | null => authToken

export const setUnauthorizedHandler = (handler: (() => void) | null): void => {
  onUnauthorized = handler
}

// ---------------------------------------------------------------------------
// Transport
//
// A Tauri webview's origin is `tauri://localhost`, which the backend's CORS
// allowlist does not (and should not) contain. The HTTP plugin issues the
// request from Rust instead, where CORS does not apply — so the desktop build
// never depends on the server allowlisting a client origin. In a plain browser
// (vite dev, `pnpm build` preview) this falls back to window.fetch.
// ---------------------------------------------------------------------------
type FetchFn = typeof globalThis.fetch

let transportPromise: Promise<FetchFn> | null = null

const resolveTransport = async (): Promise<FetchFn> => {
  if (!isDesktopRuntime) return globalThis.fetch.bind(globalThis)
  const plugin = await import('@tauri-apps/plugin-http')
  return plugin.fetch as unknown as FetchFn
}

const getTransport = (): Promise<FetchFn> => {
  transportPromise ??= resolveTransport()
  return transportPromise
}

const buildQueryString = (query: RequestOptions['query']): string => {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

const parsePayload = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }
  return response.text()
}

/** FastAPI returns `detail` as a string, or an array of field errors for 422. */
const extractMessage = (status: number, payload: unknown): string => {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown; loc?: unknown[] }
      if (typeof first?.msg === 'string') {
        const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined
        return field ? `${String(field)}: ${first.msg}` : first.msg
      }
    }
  }
  if (status === 0) return 'Network unreachable'
  return `Request failed (${status})`
}

const isFormData = (body: unknown): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const fetchImpl = await getTransport()
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}${buildQueryString(options.query)}`

  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }

  if (!options.anonymous && authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const formBody = isFormData(options.body)
  const jsonBody = options.body !== undefined && options.body !== null && !formBody
  if (jsonBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers,
      body: jsonBody
        ? JSON.stringify(options.body)
        : formBody
          ? (options.body as FormData)
          : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(error instanceof Error ? error.message : 'Network request failed', 0, error)
  }

  const payload = await parsePayload(response)

  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.()
    throw new ApiError(extractMessage(response.status, payload), response.status, payload)
  }

  return payload as TResponse
}
