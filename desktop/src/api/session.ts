import { API_BASE_URL } from '@/lib/config'
import { secureStore } from '@/lib/secure-store'
import { getTransport } from '@/api/transport'

/**
 * Access and refresh token lifecycle.
 *
 * The backend issues a 15-minute access token and a rotating refresh token
 * that extends a 180-day device session. Three rules from the contract shape
 * everything here:
 *
 *  1. Exactly one refresh may be in flight per session — including across
 *     browser tabs. A second one racing the first is treated by the server as
 *     token reuse and revokes the whole session. (Verified: the losing request
 *     gets 401 and every later call returns "Session expired or revoked".)
 *  2. A refresh token is single-use. Never retry one, not even after a lost
 *     response — a replay revokes the session.
 *  3. Only a definitive 401 means "log in again". Network errors, 429 and 5xx
 *     leave the session intact and must not clear login state.
 */

const REFRESH_TOKEN_KEY = 'refresh-token'

/** Refresh this long before expiry, so a slow request never races the clock. */
const EXPIRY_SKEW_MS = 60_000

/** Cross-tab mutual exclusion; the name is shared by every tab of this app. */
const REFRESH_LOCK = 'qq.auth.refresh'

export interface SessionTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
  sessionId: string | null
}

interface TokenResponseBody {
  access_token: string
  token_type: string
  refresh_token: string | null
  expires_in: number
  session_id: string | null
}

let accessToken: string | null = null
let expiresAt = 0
let authSessionId: string | null = null
let inFlight: Promise<string | null> | null = null
let onSessionLost: ((reason: string) => void) | null = null

export const setSessionLostHandler = (handler: ((reason: string) => void) | null): void => {
  onSessionLost = handler
}

/**
 * Ends the session from outside the HTTP path — used when the socket is closed
 * with code 4001, which the server sends the moment a device is revoked.
 */
export const notifySessionLost = (reason: string): void => {
  loseSession(reason)
}

const loseSession = (reason: string): null => {
  accessToken = null
  expiresAt = 0
  authSessionId = null
  void secureStore.clear(REFRESH_TOKEN_KEY)
  onSessionLost?.(reason)
  return null
}

/** Called by login and by every refresh; persists the rotated refresh token. */
export const adoptTokens = async (body: TokenResponseBody): Promise<SessionTokens> => {
  accessToken = body.access_token
  expiresAt = Date.now() + Math.max(0, (body.expires_in ?? 900) * 1000)
  authSessionId = body.session_id ?? authSessionId

  // Persist the replacement before anything is allowed to use the new access
  // token: if the app dies in between, the old refresh token is already dead
  // and only the stored one can revive the session.
  if (body.refresh_token) {
    await secureStore.set(REFRESH_TOKEN_KEY, body.refresh_token)
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt,
    sessionId: authSessionId,
  }
}

export const getAccessToken = (): string | null => accessToken
export const getAuthSessionId = (): string | null => authSessionId
export const hasStoredSession = (): Promise<boolean> =>
  secureStore.get(REFRESH_TOKEN_KEY).then((token) => Boolean(token))

export const clearSession = async (): Promise<void> => {
  accessToken = null
  expiresAt = 0
  authSessionId = null
  await secureStore.clear(REFRESH_TOKEN_KEY)
}

const isExpiring = (): boolean => !accessToken || Date.now() >= expiresAt - EXPIRY_SKEW_MS

/**
 * The refresh itself. Deliberately bypasses `apiRequest`: that function calls
 * back into here on a 401, and a refresh must never trigger another refresh.
 */
const performRefresh = async (): Promise<string | null> => {
  const refreshToken = await secureStore.get(REFRESH_TOKEN_KEY)
  if (!refreshToken) return loseSession('No stored session')

  const fetchImpl = await getTransport()
  let response: Response
  try {
    response = await fetchImpl(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      // `credentials` matters only for the cookie-based web flow; the desktop
      // client authenticates as a device and sends the token explicitly.
      credentials: 'include',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    // Offline. The session is still valid — the app should retry, not log out.
    return null
  }

  if (response.status === 401 || response.status === 403) {
    // 403 here is an Origin/CORS misconfiguration rather than a dead session,
    // but either way looping on refresh would only hammer the server.
    const reason =
      response.status === 403
        ? 'This origin is not allowed by the server'
        : 'Session expired. Please sign in again.'
    return loseSession(reason)
  }

  if (!response.ok) {
    // 429 or 5xx: transient. Keep the session and let the caller back off.
    return null
  }

  const body = (await response.json()) as TokenResponseBody
  await adoptTokens(body)
  return body.access_token
}

/**
 * One refresh at a time, process-wide and tab-wide.
 *
 * `navigator.locks` gives the cross-tab half; the module-level promise gives
 * the in-process half and also covers webviews without the Locks API.
 */
const refreshOnce = (): Promise<string | null> => {
  inFlight ??= (async () => {
    try {
      if (typeof navigator !== 'undefined' && 'locks' in navigator) {
        return await navigator.locks.request(REFRESH_LOCK, async () => {
          // Another tab may have refreshed while this one waited for the lock.
          if (!isExpiring()) return accessToken
          return performRefresh()
        })
      }
      return await performRefresh()
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** A valid access token, refreshing first if the current one is near expiry. */
export const ensureAccessToken = async (): Promise<string | null> => {
  if (!isExpiring()) return accessToken
  return refreshOnce()
}

/** Forces a refresh after a 401, without consulting the expiry clock. */
export const refreshAfterUnauthorized = (): Promise<string | null> => refreshOnce()

/**
 * Keeps the token fresh while the app is idle, so the first click after a
 * coffee break does not pay for a round trip — and so the socket, which is
 * opened with a token in its URL, can always be handed a live one.
 */
export const scheduleProactiveRefresh = (): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null

  const tick = () => {
    if (!accessToken) return
    const delay = Math.max(15_000, expiresAt - Date.now() - EXPIRY_SKEW_MS)
    timer = setTimeout(() => {
      void refreshOnce().finally(tick)
    }, delay)
  }

  tick()
  return () => {
    if (timer) clearTimeout(timer)
  }
}
