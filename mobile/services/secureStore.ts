import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Where the refresh token lives on a device.
 *
 * A refresh token extends a session for up to 180 days, so it belongs in the
 * iOS Keychain / Android Keystore rather than in AsyncStorage, which is plain
 * files any process with the app's data directory can read.
 *
 * `expo-secure-store` needs a native build. A dev client built before this
 * module was added has no such module, so every call falls back to
 * AsyncStorage rather than crashing on startup — the app still works, it just
 * stores the credential less well until the next build.
 */
const isAvailable = typeof SecureStore?.setItemAsync === 'function'

const fallbackKey = (key: string): string => `qq.secret.${key}`

export const secureStore = {
	async set(key: string, value: string): Promise<void> {
		if (isAvailable) {
			try {
				await SecureStore.setItemAsync(key, value, {
					keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
				})
				return
			} catch {
				// Fall through: a locked keychain must not lose the session.
			}
		}
		await AsyncStorage.setItem(fallbackKey(key), value)
	},

	async get(key: string): Promise<string | null> {
		if (isAvailable) {
			try {
				const value = await SecureStore.getItemAsync(key)
				if (value) return value
			} catch {
				// Fall through to the legacy location.
			}
		}
		return AsyncStorage.getItem(fallbackKey(key))
	},

	async clear(key: string): Promise<void> {
		if (isAvailable) {
			try {
				await SecureStore.deleteItemAsync(key)
			} catch {
				// Ignore: the fallback below still runs.
			}
		}
		await AsyncStorage.removeItem(fallbackKey(key))
	},
}
