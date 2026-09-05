import { Platform } from 'react-native'

import { API_BASE_URL } from '@/services/api/config'
import { secureStore } from '@/services/secureStore'

/**
 * Access and refresh token lifecycle.
 *
 * The backend issues a 15-minute access token and a rotating refresh token
 * that extends a device session for up to 180 days. Three rules from the
 * contract shape everything here:
 *
 *  1. Exactly one refresh may be in flight per session. A second one racing
 *     the first is read by the server as token reuse and revokes the session —
 *     verified against production, where the loser gets 401 and every later
 *     call answers "Session expired or revoked".
 *  2. A refresh token is single-use. It is never retried, not even after a
 *     lost response.
 *  3. Only a definitive 401 means "sign in again". Network errors, 429 and 5xx
 *     leave the session intact.
 */

const REFRESH_TOKEN_KEY = 'qq-refresh-token'

/** Refresh this long before expiry, so a slow request never races the clock. */
const EXPIRY_SKEW_MS = 60_000

/**
 * How this client authenticates.
 *
 * `web` is the better mode: the refresh token comes back in a Secure, HttpOnly,
 * host-only cookie that JavaScript — and therefore any XSS — cannot read. But
 * a host-only cookie is only sent back to the API's own site, so it is useless
 * to a web build served from anywhere else, and that build would lose its
 * session every fifteen minutes. So the browser build asks for the cookie flow
 * only when it is same-site with the API, and otherwise authenticates as a
 * device, exactly as the native apps do.
 */
const isSameSiteWithApi = (): boolean => {
	if (Platform.OS !== 'web' || typeof window === 'undefined') {
		return false
	}
	try {
		const registrable = (host: string) => host.split('.').slice(-2).join('.')
		return registrable(new URL(API_BASE_URL).hostname) === registrable(window.location.hostname)
	} catch {
		return false
	}
}

export const CLIENT_TYPE: 'mobile' | 'web' =
	Platform.OS === 'web' && isSameSiteWithApi() ? 'web' : 'mobile'

export interface TokenResponseBody {
	access_token: string
	token_type: string
	refresh_token?: string | null
	expires_in?: number
	session_id?: string | null
}

let accessToken: string | null = null
let expiresAt = 0
let authSessionId: string | null = null
let inFlight: Promise<string | null> | null = null
let onTokens: ((token: string) => void) | null = null
let onSessionLost: ((reason: string) => void) | null = null

/** The store subscribes so `session.token` always holds the live token. */
export const setTokenListener = (listener: ((token: string) => void) | null): void => {
	onTokens = listener
}

export const setSessionLostHandler = (handler: ((reason: string) => void) | null): void => {
	onSessionLost = handler
}

/**
 * Ends the session from outside the HTTP path — used when the socket closes
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
export const adoptTokens = async (body: TokenResponseBody): Promise<string> => {
	accessToken = body.access_token
	expiresAt = Date.now() + Math.max(0, (body.expires_in ?? 900) * 1000)
	authSessionId = body.session_id ?? authSessionId

	// Persist the replacement before the new access token is used: if the app
	// dies in between, the old refresh token is already dead and only the
	// stored one can revive the session.
	if (body.refresh_token) {
		await secureStore.set(REFRESH_TOKEN_KEY, body.refresh_token)
	} else if (CLIENT_TYPE === 'web') {
		// The web flow keeps the token in a cookie; this only records that a
		// session exists, so a reload knows to try refreshing.
		await secureStore.set(REFRESH_TOKEN_KEY, 'cookie')
	}

	onTokens?.(body.access_token)
	return body.access_token
}

export const getAccessToken = (): string | null => accessToken
export const getAuthSessionId = (): string | null => authSessionId
export const hasStoredSession = (): Promise<boolean> =>
	secureStore.get(REFRESH_TOKEN_KEY).then(token => Boolean(token))

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
	const stored = await secureStore.get(REFRESH_TOKEN_KEY)
	if (!stored) return loseSession('No stored session')

	let response: Response
	try {
		response = await fetch(`${API_BASE_URL}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			credentials: 'include',
			body: JSON.stringify(
				CLIENT_TYPE === 'web' ? {} : { refresh_token: stored },
			),
		})
	} catch {
		// Offline. The session is still valid — retry later, do not sign out.
		return null
	}

	if (response.status === 401 || response.status === 403) {
		return loseSession(
			response.status === 403
				? 'This app origin is not allowed by the server'
				: 'Session expired. Please sign in again.',
		)
	}

	if (!response.ok) {
		// 429 or 5xx: transient.
		return null
	}

	const body = (await response.json()) as TokenResponseBody
	return adoptTokens(body)
}

/** One refresh at a time, process-wide. */
const refreshOnce = (): Promise<string | null> => {
	inFlight ??= performRefresh().finally(() => {
		inFlight = null
	})
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
 * Keeps the token fresh while the app is idle. The socket is opened with a
 * token in its URL, so a stale one would fail every reconnect.
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
