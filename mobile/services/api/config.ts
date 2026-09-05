import Constants from 'expo-constants'

const DEFAULT_API_BASE_URL = 'https://messanger.cognilabs.org'
const DEFAULT_WS_BASE_URL = 'wss://messanger.cognilabs.org'

const normalizeBaseUrl = (
	value: string | undefined,
	fallback: string,
): string => {
	const source = value?.trim() || fallback
	return source.replace(/\/+$/, '')
}

const normalizeWsUrl = (value: string): string => {
	if (value.startsWith('https://')) {
		return `wss://${value.slice('https://'.length)}`
	}
	if (value.startsWith('http://')) {
		return `ws://${value.slice('http://'.length)}`
	}
	return value
}

// Read the EXPO_PUBLIC_* keys literally: Expo inlines them at build time only when the
// property access is static, so a dynamic `env[key]` lookup would silently fall back.
const env = {
	EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
	EXPO_PUBLIC_WS_BASE_URL: process.env.EXPO_PUBLIC_WS_BASE_URL,
	EXPO_PUBLIC_USE_LOCAL_MEDIA_UPLOAD: process.env.EXPO_PUBLIC_USE_LOCAL_MEDIA_UPLOAD,
	EXPO_PUBLIC_USE_MOCK_API: process.env.EXPO_PUBLIC_USE_MOCK_API,
}
const extra = (Constants.expoConfig?.extra ?? {}) as {
	apiBaseUrl?: string
	wsBaseUrl?: string
	useLocalMediaUpload?: string | boolean
}

export const API_BASE_URL = normalizeBaseUrl(
	env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl,
	DEFAULT_API_BASE_URL,
)
export const WS_BASE_URL = normalizeWsUrl(
	normalizeBaseUrl(
		env.EXPO_PUBLIC_WS_BASE_URL ?? extra.wsBaseUrl,
		DEFAULT_WS_BASE_URL,
	),
)

/**
 * Every platform talks to the real API. The in-app mock backend is still there for
 * working on the UI with nothing running — set EXPO_PUBLIC_USE_MOCK_API=true to use it —
 * but it is opt-in, so a plain build is always the integrated one.
 */
export const USE_MOCK_API = (() => {
	const raw = env.EXPO_PUBLIC_USE_MOCK_API
	return typeof raw === 'string' && (raw.toLowerCase() === 'true' || raw === '1')
})()

const localUploadRaw =
	env.EXPO_PUBLIC_USE_LOCAL_MEDIA_UPLOAD ?? extra.useLocalMediaUpload
export const USE_LOCAL_MEDIA_UPLOAD =
	typeof localUploadRaw === 'boolean'
		? localUploadRaw
		: String(localUploadRaw ?? 'true').toLowerCase() !== 'false'
