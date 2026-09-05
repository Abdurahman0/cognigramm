import { Platform } from 'react-native'

/**
 * A name for this device, shown in the account's session list so a user can
 * tell which row to revoke.
 *
 * Built from what React Native already knows rather than pulling in a native
 * device-info module: an extra native dependency would mean another build for
 * a string.
 */
export const describeDevice = (): string => {
	if (Platform.OS === 'web') {
		const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
		const browser = /Firefox\//.test(agent)
			? 'Firefox'
			: /Edg\//.test(agent)
				? 'Edge'
				: /Chrome\//.test(agent)
					? 'Chrome'
					: /Safari\//.test(agent)
						? 'Safari'
						: 'Browser'
		return `Qora Qarga Web — ${browser}`
	}

	if (Platform.OS === 'android') {
		const constants = Platform.constants as { Model?: string; Brand?: string; Release?: string }
		const model = [constants.Brand, constants.Model].filter(Boolean).join(' ').trim()
		return model ? `${model} (Android ${constants.Release ?? ''})`.trim() : 'Android device'
	}

	if (Platform.OS === 'ios') {
		return `${Platform.isPad ? 'iPad' : 'iPhone'} (iOS ${String(Platform.Version)})`
	}

	return `Qora Qarga (${Platform.OS})`
}
