import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/hooks/useAppTheme'

interface TypingIndicatorProps {
	label?: string
}

const DOT_BOUNCE_OFFSET = 4
const DOT_ANIMATION_DURATION_MS = 320
const DOT_STAGGER_MS = 140

export function TypingIndicator({ label = 'Typing' }: TypingIndicatorProps) {
	const { theme } = useAppTheme()
	const dot1 = useRef(new Animated.Value(0)).current
	const dot2 = useRef(new Animated.Value(0)).current
	const dot3 = useRef(new Animated.Value(0)).current

	useEffect(() => {
		const buildLoop = (value: Animated.Value, delay: number) =>
			Animated.loop(
				Animated.sequence([
					Animated.delay(delay),
					Animated.timing(value, {
						toValue: 1,
						duration: DOT_ANIMATION_DURATION_MS,
						easing: Easing.inOut(Easing.ease),
						useNativeDriver: true,
					}),
					Animated.timing(value, {
						toValue: 0,
						duration: DOT_ANIMATION_DURATION_MS,
						easing: Easing.inOut(Easing.ease),
						useNativeDriver: true,
					}),
				]),
			)

		const a1 = buildLoop(dot1, 0)
		const a2 = buildLoop(dot2, DOT_STAGGER_MS)
		const a3 = buildLoop(dot3, DOT_STAGGER_MS * 2)
		a1.start()
		a2.start()
		a3.start()

		return () => {
			a1.stop()
			a2.stop()
			a3.stop()
		}
	}, [dot1, dot2, dot3])

	const createDotStyle = (value: Animated.Value) => ({
		opacity: value.interpolate({
			inputRange: [0, 1],
			outputRange: [0.45, 1],
		}),
		transform: [
			{
				translateY: value.interpolate({
					inputRange: [0, 1],
					outputRange: [DOT_BOUNCE_OFFSET, -DOT_BOUNCE_OFFSET],
				}),
			},
		],
	})

	return (
		<View
			style={styles.row}
			accessibilityRole='text'
			accessibilityLabel={label}
		>
			<View
				style={[
					styles.bubble,
					{
						backgroundColor: theme.colors.messageOther,
						borderColor: theme.colors.border,
					},
				]}
			>
				<View style={styles.dotsRow}>
					<Animated.View
						style={[
							styles.dot,
							{ backgroundColor: theme.colors.textMuted },
							createDotStyle(dot1),
						]}
					/>
					<Animated.View
						style={[
							styles.dot,
							{ backgroundColor: theme.colors.textMuted },
							createDotStyle(dot2),
						]}
					/>
					<Animated.View
						style={[
							styles.dot,
							{ backgroundColor: theme.colors.textMuted },
							createDotStyle(dot3),
						]}
					/>
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		marginVertical: 4,
	},
	bubble: {
		alignItems: 'center',
		borderRadius: 16,
		borderWidth: 1,
		justifyContent: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	dotsRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6,
		height: 14,
	},
	dot: {
		borderRadius: 999,
		height: 6,
		width: 6,
	},
})
