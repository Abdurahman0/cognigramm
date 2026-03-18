import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
	name: "Qora Qarg'a",
	slug: 'qora-qaraga',
	version: '1.1.0',
	orientation: 'portrait',
	scheme: 'qoraqarga',
	userInterfaceStyle: 'automatic',
	newArchEnabled: true,
	icon: './assets/logo.png',
	splash: {
		image: './assets/logo.png',
		// Use "contain" so the logo stays fully visible on all aspect ratios.
		resizeMode: 'contain',
		// Black background matches brand tone and avoids visible edge halos.
		backgroundColor: '#000000',
	},
	assetBundlePatterns: ['**/*'],
	ios: {
		supportsTablet: true,
		bundleIdentifier: 'com.company.messenger',
		icon: './assets/logo.png',
	},
	android: {
		package: 'com.company.messenger',
		softwareKeyboardLayoutMode: 'resize',
		versionCode: 2,
		// Android adaptive icons are masked by the system, so a foreground image prevents cropping.
		adaptiveIcon: {
			foregroundImage: './assets/logo.png',
			// Black background keeps the mask edge clean around the logo.
			backgroundColor: '#000000',
		},
	},
	web: {
		bundler: 'metro',
		output: 'single',
		favicon: './assets/logo.png',
	},
	plugins: [
		'expo-router',
		'expo-system-ui',
		[
			'expo-build-properties',
			{
				android: {
					compileSdkVersion: 36,
					targetSdkVersion: 36,
					buildToolsVersion: '36.0.0',
				},
			},
		],
		'./plugins/withAndroidXActivityFix',
		[
			'expo-av',
			{
				microphonePermission:
					'Allow this app to access your microphone to record voice messages.',
			},
		],
		[
			'expo-image-picker',
			{
				photosPermission:
					'Allow this app to access your photos for message attachments.',
				cameraPermission:
					'Allow this app to access your camera for video notes.',
				microphonePermission:
					'Allow this app to access your microphone for video notes.',
			},
		],
		[
			'@config-plugins/react-native-webrtc',
			{
				cameraPermission:
					'Allow this app to access your camera for video calls.',
				microphonePermission:
					'Allow this app to access your microphone for calls.',
			},
		],
	],
	experiments: {
		typedRoutes: true,
	},
	extra: {
		router: {},
		eas: {
			projectId: '4490cd62-27f2-4590-b128-010a9899c60b',
		},
	},
	owner: 'abdurahmanrahmanbekov',
}

export default config
