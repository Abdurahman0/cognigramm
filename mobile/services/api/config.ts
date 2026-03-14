import Constants from 'expo-constants'
import { Platform } from 'react-native'

const DEFAULT_API_BASE_URL =
	Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000'
const DEFAULT_WS_BASE_URL =
	Platform.OS === 'android' ? 'ws://10.0.2.2:8001' : 'ws://localhost:8001'

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

const env =
	(globalThis as { process?: { env?: Record<string, string | undefined> } })
		.process?.env ?? {}
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

const localUploadRaw =
	env.EXPO_PUBLIC_USE_LOCAL_MEDIA_UPLOAD ?? extra.useLocalMediaUpload
export const USE_LOCAL_MEDIA_UPLOAD =
	typeof localUploadRaw === 'boolean'
		? localUploadRaw
		: String(localUploadRaw ?? 'true').toLowerCase() !== 'false'
