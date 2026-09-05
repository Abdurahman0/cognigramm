import { API_BASE_URL } from '@/lib/config'
import { getTransport } from '@/api/transport'
import { ensureAccessToken, getAccessToken, refreshAfterUnauthorized } from '@/api/session'

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

  /** Status 0 is this client's marker for "the request never reached anyone". */
  get isOffline(): boolean {
    return this.status === 0
  }

  /** Worth retrying: the request itself was fine, the server or link was not. */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500
  }
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
  if (status === 413) return 'That file is too large (100 MB maximum)'
  if (status === 502) return 'Storage provider is unavailable, try again'
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

  const formBody = isFormData(options.body)
  const jsonBody = options.body !== undefined && options.body !== null && !formBody

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
    if (token) headers.Authorization = `Bearer ${token}`
    // Multipart must not carry an explicit Content-Type: only the client can
    // generate the boundary that goes with the body it is about to write.
    if (jsonBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

    return fetchImpl(url, {
      method: options.method ?? 'GET',
      headers,
      body: jsonBody
        ? JSON.stringify(options.body)
        : formBody
          ? (options.body as FormData)
          : undefined,
      signal: options.signal,
      credentials: 'include',
    })
  }

  const attempt = async (token: string | null): Promise<Response> => {
    try {
      return await send(token)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ApiError(
        error instanceof Error ? error.message : 'Network request failed',
        0,
        error,
      )
    }
  }

  // A 15-minute access token expires often enough that refreshing up front is
  // the common path, not the exception.
  const token = options.anonymous ? null : await ensureAccessToken()
  let response = await attempt(token)

  // One retry, and only one: the refresh above already handled the predictable
  // case, so a 401 here means the token died mid-flight or was revoked.
  if (response.status === 401 && !options.anonymous) {
    const renewed = await refreshAfterUnauthorized()
    if (renewed) {
      response = await attempt(renewed)
    } else if (getAccessToken()) {
      // Refresh failed transiently and the old token is still all we have.
      response = await attempt(getAccessToken())
    }
  }

  const payload = await parsePayload(response)

  if (!response.ok) {
    throw new ApiError(extractMessage(response.status, payload), response.status, payload)
  }

  return payload as TResponse
}
