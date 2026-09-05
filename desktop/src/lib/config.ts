/**
 * Runtime endpoints.
 *
 * The production domains are the defaults rather than a localhost pair, so a
 * build with no .env still points at the real backend; `.env` only exists to
 * aim a developer machine somewhere else.
 */
const DEFAULT_API_BASE_URL = 'https://messanger.cognilabs.org'
const DEFAULT_WS_BASE_URL = 'wss://messanger.cognilabs.org'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const normalizeBase = (value: string | undefined, fallback: string): string =>
  trimTrailingSlash(value?.trim() || fallback)

/** `https://host` -> `wss://host`, so one env var can drive both if needed. */
const toWebSocketScheme = (value: string): string => {
  if (value.startsWith('https://')) return `wss://${value.slice('https://'.length)}`
  if (value.startsWith('http://')) return `ws://${value.slice('http://'.length)}`
  return value
}

export const API_BASE_URL = normalizeBase(import.meta.env.VITE_API_BASE_URL, DEFAULT_API_BASE_URL)

export const WS_BASE_URL = toWebSocketScheme(
  normalizeBase(import.meta.env.VITE_WS_BASE_URL, DEFAULT_WS_BASE_URL),
)

export const WS_CHAT_URL = `${WS_BASE_URL}/ws/chat`

export const APP_NAME = "Qora Qarg'a"
