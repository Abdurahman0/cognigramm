/**
 * Web half of the secure store.
 *
 * There is no Keychain in a browser. The web build authenticates with
 * `client_type: "web"`, where the refresh token never reaches JavaScript at
 * all — it lives in a Secure, HttpOnly cookie — so nothing sensitive is
 * written here; this only records that a session exists.
 */
const storageKey = (key: string): string => `qq.secret.${key}`

export const secureStore = {
	async set(key: string, value: string): Promise<void> {
		try {
			localStorage.setItem(storageKey(key), value)
		} catch {
			// Private mode: the session simply will not survive a reload.
		}
	},

	async get(key: string): Promise<string | null> {
		try {
			return localStorage.getItem(storageKey(key))
		} catch {
			return null
		}
	},

	async clear(key: string): Promise<void> {
		try {
			localStorage.removeItem(storageKey(key))
		} catch {
			// Nothing to clean up.
		}
	},
}
