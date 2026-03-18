import { Feather } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import {
	Keyboard,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'

import { useAppTheme } from '@/hooks/useAppTheme'

interface ChatComposerProps {
	keyboardVisible?: boolean
	sendingLocked?: boolean
	onTypingStart?: () => void
	onTypingStop?: () => void
	onSend: (body: string) => void
	onSendAttachment: () => void
}

const emojiCatalog = [
	'\u{1F600}',
	'\u{1F601}',
	'\u{1F602}',
	'\u{1F60A}',
	'\u{1F44D}',
	'\u{1F44F}',
	'\u{1F64F}',
	'\u{1F525}',
	'\u{2705}',
	'\u{1F3AF}',
	'\u{1F4BC}',
	'\u{1F4CC}',
	'\u{1F4CE}',
	'\u{1F680}',
	'\u{2757}',
	'\u{23F0}',
]

export function ChatComposer({
	keyboardVisible = false,
	sendingLocked = false,
	onTypingStart,
	onTypingStop,
	onSend,
	onSendAttachment,
}: ChatComposerProps): JSX.Element {
	const { theme } = useAppTheme()
	const minInputHeight =
		Platform.OS === 'ios' ? 22 : Platform.OS === 'web' ? 24 : 20
	const TYPING_STOP_DELAY_MS = 0
	const [text, setText] = useState('')
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
	const [inputHeight, setInputHeight] = useState(minInputHeight)
	const typingActiveRef = useRef(false)
	const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const clearTypingTimeout = () => {
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current)
			typingTimeoutRef.current = null
		}
	}

	const stopTyping = () => {
		clearTypingTimeout()
		if (!typingActiveRef.current) {
			return
		}
		typingActiveRef.current = false
		onTypingStop?.()
	}

	const startTyping = () => {
		if (!typingActiveRef.current) {
			typingActiveRef.current = true
		}
		onTypingStart?.()
		clearTypingTimeout()
		typingTimeoutRef.current = setTimeout(() => {
			stopTyping()
		}, TYPING_STOP_DELAY_MS)
	}

	useEffect(
		() => () => {
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current)
				typingTimeoutRef.current = null
			}
			if (typingActiveRef.current) {
				typingActiveRef.current = false
				onTypingStop?.()
			}
		},
		[onTypingStop],
	)

	const handleTextChange = (value: string) => {
		setText(value)
		if (value.trim().length === 0) {
			stopTyping()
			return
		}
		startTyping()
	}

	const handleSend = () => {
		if (sendingLocked) {
			return
		}
		const value = text.trim()
		if (!value) {
			return
		}
		onSend(value)
		setText('')
		setInputHeight(minInputHeight)
		setEmojiPickerOpen(false)
		stopTyping()
		Keyboard.dismiss()
	}

	const appendEmoji = (emoji: string) => {
		setText(current => `${current}${emoji}`)
	}

	return (
		<View
			style={[
				styles.root,
				{
					borderTopColor: theme.colors.border,
					backgroundColor: theme.colors.surface,
				},
			]}
		>
			{emojiPickerOpen ? (
				<View
					style={[
						styles.emojiPanel,
						{
							backgroundColor: theme.colors.surfaceMuted,
							borderColor: theme.colors.border,
						},
					]}
				>
					{emojiCatalog.map(emoji => (
						<Pressable
							key={emoji}
							onPress={() => appendEmoji(emoji)}
							style={({ pressed }) => [
								styles.emojiButton,
								{
									backgroundColor: pressed
										? theme.colors.surface
										: 'transparent',
								},
							]}
						>
							<Text style={styles.emojiText}>{emoji}</Text>
						</Pressable>
					))}
				</View>
			) : null}

			<View
				style={[
					styles.composerShell,
					keyboardVisible && styles.composerShellKeyboardOpen,
					Platform.OS === 'web' && styles.composerShellWeb,
					{
						borderColor: theme.colors.border,
						backgroundColor: theme.colors.surfaceMuted,
						borderWidth: Platform.OS === 'web' ? 0 : 1,
					},
				]}
			>
				<Pressable
					onPress={() => setEmojiPickerOpen(open => !open)}
					style={[
						styles.iconButton,
						keyboardVisible && styles.iconButtonKeyboardOpen,
					]}
					hitSlop={8}
				>
					<Feather name='smile' size={20} color={theme.colors.textSecondary} />
				</Pressable>

				<View
					style={[
						styles.inputWrap,
						keyboardVisible && styles.inputWrapKeyboardOpen,
						Platform.OS === 'web' && styles.inputWrapWeb,
					]}
				>
					<TextInput
						value={text}
						onChangeText={handleTextChange}
						placeholder='Type a message'
						placeholderTextColor={theme.colors.textMuted}
						multiline
						blurOnSubmit={false}
						onFocus={() => setEmojiPickerOpen(false)}
						onBlur={stopTyping}
						onContentSizeChange={event => {
							const nextHeight = Math.max(
								minInputHeight,
								Math.min(94, event.nativeEvent.contentSize.height),
							)
							setInputHeight(nextHeight)
						}}
						style={[
							styles.input,
							keyboardVisible && styles.inputKeyboardOpen,
							Platform.OS === 'web' && styles.inputWeb,
							{
								color: theme.colors.textPrimary,
								height: inputHeight,
							},
						]}
					/>
				</View>

				<Pressable
					onPress={sendingLocked ? undefined : onSendAttachment}
					style={[
						styles.iconButton,
						keyboardVisible && styles.iconButtonKeyboardOpen,
						sendingLocked && styles.buttonDisabled,
					]}
					hitSlop={8}
				>
					<Feather
						name='paperclip'
						size={20}
						color={theme.colors.textSecondary}
					/>
				</Pressable>

				<Pressable
					onPress={sendingLocked ? undefined : handleSend}
					style={[
						styles.sendButton,
						keyboardVisible && styles.sendButtonKeyboardOpen,
						{
							backgroundColor:
								!sendingLocked && text.trim().length > 0
									? theme.colors.accent
									: theme.colors.textMuted,
						},
						sendingLocked && styles.buttonDisabled,
					]}
					hitSlop={8}
				>
					<Feather name='send' size={17} color='#FFFFFF' />
				</Pressable>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		borderTopWidth: 1,
		gap: 6,
		paddingHorizontal: 12,
		paddingTop: 6,
		paddingBottom: 4,
	},
	composerShell: {
		alignItems: 'flex-end',
		borderRadius: 24,
		borderWidth: 1,
		flexDirection: 'row',
		minHeight: 50,
		paddingLeft: 8,
		paddingRight: 6,
		paddingVertical: 6,
	},
	composerShellWeb: {
		alignItems: 'center',
		paddingVertical: 4,
	},
	composerShellKeyboardOpen: {
		paddingVertical: 7,
	},
	iconButton: {
		alignItems: 'center',
		borderRadius: 16,
		height: 34,
		justifyContent: 'center',
		width: 32,
	},
	iconButtonKeyboardOpen: {
		alignSelf: 'center',
	},
	inputWrap: {
		flex: 1,
		justifyContent: 'center',
		marginHorizontal: 3,
		minHeight: 34,
	},
	inputWrapKeyboardOpen: {
		minHeight: 36,
	},
	inputWrapWeb: {
		minHeight: 36,
	},
	input: {
		flex: 1,
		fontSize: 15,
		lineHeight: 20,
		maxHeight: 94,
		minHeight: 20,
		paddingBottom: Platform.OS === 'ios' ? 2 : 0,
		paddingHorizontal: 6,
		paddingTop: 0,
		textAlignVertical: 'center',
	},
	inputWeb: {
		paddingBottom: 4,
		paddingTop: 4,
		outlineStyle: 'solid',
		outlineWidth: 0,
		outlineColor: 'transparent',
	},
	inputKeyboardOpen: {
		paddingBottom: 1,
		paddingTop: 1,
	},
	sendButton: {
		alignItems: 'center',
		borderRadius: 17,
		height: 34,
		justifyContent: 'center',
		marginLeft: 6,
		width: 34,
	},
	sendButtonKeyboardOpen: {
		alignSelf: 'center',
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	emojiPanel: {
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		padding: 8,
	},
	emojiButton: {
		alignItems: 'center',
		borderRadius: 8,
		height: 34,
		justifyContent: 'center',
		width: 34,
	},
	emojiText: {
		fontSize: 21,
	},
})
