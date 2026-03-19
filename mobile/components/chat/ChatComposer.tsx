import { Feather } from '@expo/vector-icons'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
	Keyboard,
	type NativeSyntheticEvent,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	type TextInputKeyPressEventData,
	View,
} from 'react-native'

import { useAppTheme } from '@/hooks/useAppTheme'

interface ChatComposerProps {
	keyboardVisible?: boolean
	sendingLocked?: boolean
	autoFocus?: boolean
	focusSignal?: string
	draftValue?: string
	onDraftChange?: (value: string) => void
	editingLabel?: string
	onCancelEditing?: () => void
	mediaActionsSlot?: ReactNode
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

const isTouchWebDevice = (): boolean => {
	if (Platform.OS !== 'web' || typeof window === 'undefined') {
		return false
	}

	const coarsePointer =
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(pointer: coarse)').matches
	const maxTouchPoints =
		typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0

	return coarsePointer || maxTouchPoints > 0 || 'ontouchstart' in window
}

export function ChatComposer({
	keyboardVisible = false,
	sendingLocked = false,
	autoFocus = false,
	focusSignal = '',
	draftValue,
	onDraftChange,
	editingLabel,
	onCancelEditing,
	mediaActionsSlot,
	onTypingStart,
	onTypingStop,
	onSend,
	onSendAttachment,
}: ChatComposerProps): JSX.Element {
	const { theme } = useAppTheme()
	const touchWebDevice = isTouchWebDevice()
	const minInputHeight =
		Platform.OS === 'ios' ? 22 : Platform.OS === 'web' ? 24 : 20
	const TYPING_STOP_DELAY_MS = 0
	const [text, setText] = useState('')
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
	const [inputHeight, setInputHeight] = useState(minInputHeight)
	const inputRef = useRef<TextInput>(null)
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

	useEffect(() => {
		if (!autoFocus || Platform.OS !== 'web' || touchWebDevice) {
			return
		}
		const focusInput = () => {
			inputRef.current?.focus()
		}
		const frame = requestAnimationFrame(focusInput)
		const timer = setTimeout(focusInput, 60)
		return () => {
			cancelAnimationFrame(frame)
			clearTimeout(timer)
		}
	}, [autoFocus, focusSignal, touchWebDevice])

	useEffect(() => {
		if (typeof draftValue !== 'string') {
			return
		}
		setText(draftValue)
	}, [draftValue])

	const handleTextChange = (value: string) => {
		setText(value)
		onDraftChange?.(value)
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
		onDraftChange?.('')
		setInputHeight(minInputHeight)
		setEmojiPickerOpen(false)
		stopTyping()
		Keyboard.dismiss()
	}

	const handleWebEnterPress = (
		event: NativeSyntheticEvent<TextInputKeyPressEventData>,
	) => {
		if (Platform.OS !== 'web') {
			return
		}
		if (event.nativeEvent.key !== 'Enter') {
			return
		}
		const shiftKey = Boolean(
			(event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean })
				.shiftKey,
		)
		if (shiftKey) {
			return
		}
		;(event as unknown as { preventDefault?: () => void }).preventDefault?.()
		handleSend()
	}

	const appendEmoji = (emoji: string) => {
		setText(current => {
			const next = `${current}${emoji}`
			onDraftChange?.(next)
			return next
		})
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
			{editingLabel ? (
				<View style={[styles.editingBanner, { borderColor: theme.colors.border }]}>
					<View style={styles.editingCopy}>
						<Feather name='edit-3' size={12} color={theme.colors.accent} />
						<Text style={[styles.editingText, { color: theme.colors.textSecondary }]}>
							{editingLabel}
						</Text>
					</View>
					<Pressable onPress={onCancelEditing} hitSlop={8} style={styles.cancelEditBtn}>
						<Feather name='x' size={14} color={theme.colors.textMuted} />
					</Pressable>
				</View>
			) : null}
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
			{mediaActionsSlot ? <View style={styles.mediaActionsWrap}>{mediaActionsSlot}</View> : null}

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
						ref={inputRef}
						autoFocus={autoFocus && Platform.OS === 'web' && !touchWebDevice}
						value={text}
						onChangeText={handleTextChange}
						placeholder='Type a message'
						placeholderTextColor={theme.colors.textMuted}
						multiline
						onKeyPress={handleWebEnterPress}
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
	mediaActionsWrap: {
		paddingHorizontal: 4,
	},
	editingBanner: {
		alignItems: 'center',
		borderRadius: 10,
		borderWidth: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		minHeight: 34,
		paddingHorizontal: 10,
	},
	editingCopy: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6,
	},
	editingText: {
		fontSize: 12,
		fontWeight: '600',
	},
	cancelEditBtn: {
		alignItems: 'center',
		height: 24,
		justifyContent: 'center',
		width: 24,
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
