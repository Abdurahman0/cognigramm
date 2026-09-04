import { Feather } from '@expo/vector-icons'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
	Keyboard,
	type NativeSyntheticEvent,
	PanResponder,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	type TextInputKeyPressEventData,
	View,
} from 'react-native'

import { VideoNoteViewfinder } from '@/components/chat/VideoNoteViewfinder'
import { useAppTheme } from '@/hooks/useAppTheme'

export type ComposerRecordMode = 'voice' | 'video'

export interface ComposerRecorder {
	/** Which recorder the button is armed with. */
	mode: ComposerRecordMode
	recording: boolean
	busy: boolean
	paused: boolean
	/** Live capture, shown as a viewfinder while filming. Null where unavailable. */
	previewStream: unknown
	/** False where the platform's own camera UI owns pause and the torch. */
	canPause: boolean
	canUseTorch: boolean
	torchOn: boolean
	onStart: () => void
	onStop: () => void
	onCancel: () => void
	onTogglePause: () => void
	onToggleTorch: () => void
	/** A quick tap swaps voice for video, the way Telegram's mic button does. */
	onToggleMode: () => void
}

/** How far the finger travels before the gesture means something other than "hold". */
const CANCEL_DISTANCE = 90
const LOCK_DISTANCE = 64

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
	recorder?: ComposerRecorder
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
	recorder,
	onTypingStart,
	onTypingStop,
	onSend,
	onSendAttachment,
}: ChatComposerProps): JSX.Element {
	const { theme } = useAppTheme()
	const touchWebDevice = isTouchWebDevice()
	const minInputHeight = Platform.OS === 'ios' ? 20 : 20
	const TYPING_STOP_DELAY_MS = 0
	const [text, setText] = useState('')
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
	const [inputHeight, setInputHeight] = useState(minInputHeight)
	const inputRef = useRef<TextInput>(null)
	const typingActiveRef = useRef(false)
	const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// The gesture handlers below are created once, so everything they read lives in refs.
	const recorderRef = useRef(recorder)
	recorderRef.current = recorder
	const hasTextRef = useRef(false)
	const lockedRef = useRef(sendingLocked)
	lockedRef.current = sendingLocked
	const sendRef = useRef(() => {})
	const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	/** True once a hold has actually started a recording, so release ends it. */
	const heldRef = useRef(false)
	/** Locked recordings keep going after the finger lifts. */
	const [locked, setLocked] = useState(false)
	const handsFreeRef = useRef(false)
	/** How far the finger has slid toward cancelling, 0..1, for the affordance. */
	const [slideProgress, setSlideProgress] = useState(0)

	const clearHoldTimer = () => {
		if (holdTimerRef.current) {
			clearTimeout(holdTimerRef.current)
			holdTimerRef.current = null
		}
	}

	/**
	 * Hold to record, release to finish; a quick tap swaps voice for video note.
	 *
	 * This is a PanResponder rather than a Pressable because react-native-web releases
	 * the press a few milliseconds after `onLongPress` fires — `onPressOut` arrives while
	 * the finger is still down, so it cannot mean "let go".
	 */
	const actionGesture = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => true,
				// Starting a recording re-renders this row, and the responder system would
				// hand the gesture away mid-hold — the finger is still down, so refuse.
				onPanResponderTerminationRequest: () => false,
				onPanResponderGrant: () => {
					heldRef.current = false
					setSlideProgress(0)
					clearHoldTimer()
					if (lockedRef.current || hasTextRef.current) {
						return
					}
					const active = recorderRef.current
					if (!active || active.recording) {
						return
					}
					holdTimerRef.current = setTimeout(() => {
						heldRef.current = true
						recorderRef.current?.onStart()
					}, 220)
				},
				// Sliding left cancels, sliding up locks; both are measured from where the
				// finger went down, so the button does not have to be hit precisely.
				onPanResponderMove: (_event, gesture) => {
					if (!heldRef.current || handsFreeRef.current) {
						return
					}
					if (gesture.dy < -LOCK_DISTANCE) {
						handsFreeRef.current = true
						setLocked(true)
						setSlideProgress(0)
						return
					}
					setSlideProgress(Math.max(0, Math.min(1, -gesture.dx / CANCEL_DISTANCE)))
				},
				onPanResponderRelease: (_event, gesture) => {
					clearHoldTimer()
					const active = recorderRef.current
					if (heldRef.current) {
						heldRef.current = false
						setSlideProgress(0)
						// Locked: the recording carries on without the finger.
						if (handsFreeRef.current) {
							return
						}
						// Slid far enough to the left: throw the take away.
						if (-gesture.dx >= CANCEL_DISTANCE) {
							active?.onCancel()
							return
						}
						// Let go before the device finished opening: there is nothing worth
						// keeping, so drop it rather than stopping a recorder that never ran.
						if (active?.recording) {
							active.onStop()
						} else {
							active?.onCancel()
						}
						return
					}
					if (lockedRef.current) {
						return
					}
					if (hasTextRef.current) {
						sendRef.current()
						return
					}
					if (!active) {
						return
					}
					if (active.recording) {
						active.onStop()
						return
					}
					active.onToggleMode()
				},
				onPanResponderTerminate: () => {
					clearHoldTimer()
					setSlideProgress(0)
					if (heldRef.current && !handsFreeRef.current) {
						heldRef.current = false
						recorderRef.current?.onCancel()
					}
				},
			}),
		[],
	)

	useEffect(() => clearHoldTimer, [])

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

	const hasText = text.trim().length > 0
	hasTextRef.current = hasText
	sendRef.current = handleSend
	const recording = Boolean(recorder?.recording)
	const [elapsedMs, setElapsedMs] = useState(0)

	useEffect(() => {
		if (!recording) {
			setElapsedMs(0)
			setLocked(false)
			handsFreeRef.current = false
			return
		}
		const startedAt = Date.now()
		const timer = setInterval(() => {
			setElapsedMs(Date.now() - startedAt)
		}, 200)
		return () => {
			clearInterval(timer)
		}
	}, [recording])

	const elapsedLabel = `${Math.floor(elapsedMs / 60000)}:${String(
		Math.floor(elapsedMs / 1000) % 60,
	).padStart(2, '0')}`

	const appendEmoji = (emoji: string) => {
		setText(current => {
			const next = `${current}${emoji}`
			onDraftChange?.(next)
			return next
		})
	}

	return (
		<View style={styles.root}>
			{editingLabel ? (
				<View
					style={[
						styles.editingBanner,
						{
							borderColor: theme.colors.glassBorder,
							backgroundColor: theme.colors.glassSoft,
						},
					]}
				>
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
					{...(Platform.OS === 'web' ? { dataSet: { glass: 'soft' } } : null)}
					style={[
						styles.emojiPanel,
						{
							backgroundColor: theme.colors.glassSoft,
							borderColor: theme.colors.glassBorder,
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
										? theme.colors.glassHover
										: 'transparent',
								},
							]}
						>
							<Text style={styles.emojiText}>{emoji}</Text>
						</Pressable>
					))}
				</View>
			) : null}
			{recording && recorder?.mode === 'video' && recorder.previewStream ? (
				<View
					{...(Platform.OS === 'web' ? { dataSet: { glass: 'thick' } } : null)}
					style={[
						styles.viewfinderWrap,
						theme.elevation.floating,
						{
							backgroundColor: theme.colors.materialThick,
							borderColor: theme.colors.glassBorder,
							borderRadius: theme.radius.panel,
						},
					]}
				>
					<VideoNoteViewfinder stream={recorder.previewStream} />
					<View style={styles.viewfinderControls}>
						{recorder.canPause ? (
							<Pressable
								onPress={recorder.onTogglePause}
								accessibilityRole='button'
								accessibilityLabel={recorder.paused ? 'Resume recording' : 'Pause recording'}
								style={[styles.viewfinderButton, { backgroundColor: theme.colors.glassHover }]}
							>
								<Feather
									name={recorder.paused ? 'play' : 'pause'}
									size={16}
									color={theme.colors.textPrimary}
								/>
							</Pressable>
						) : null}
						{/* Only offered where the camera actually reports a torch. */}
						{recorder.canUseTorch ? (
							<Pressable
								onPress={recorder.onToggleTorch}
								accessibilityRole='button'
								accessibilityLabel={recorder.torchOn ? 'Turn the light off' : 'Turn the light on'}
								style={[
									styles.viewfinderButton,
									{
										backgroundColor: recorder.torchOn
											? theme.colors.accent
											: theme.colors.glassHover,
									},
								]}
							>
								<Feather
									name='zap'
									size={16}
									color={recorder.torchOn ? theme.colors.onAccent : theme.colors.textPrimary}
								/>
							</Pressable>
						) : null}
					</View>
				</View>
			) : null}
			{mediaActionsSlot ? <View style={styles.mediaActionsWrap}>{mediaActionsSlot}</View> : null}

			<View
				style={[
					styles.composerShell,
					keyboardVisible && styles.composerShellKeyboardOpen,
					Platform.OS === 'web' && styles.composerShellWeb,
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
					<Feather name='smile' size={22} color={theme.colors.textSecondary} />
				</Pressable>

				{recording ? (
					<View style={styles.recordingWrap}>
						<View
							style={[
								styles.recordingDot,
								{ backgroundColor: recorder?.paused ? theme.colors.textMuted : theme.colors.danger },
							]}
						/>
						<Text style={[styles.recordingText, { color: theme.colors.textPrimary }]}>
							{recorder?.paused ? 'Paused' : elapsedLabel}
						</Text>

						{locked ? (
							<View style={styles.lockedHint}>
								<Feather name='lock' size={13} color={theme.colors.textMuted} />
								<Text style={[styles.slideText, { color: theme.colors.textMuted }]}>Hands free</Text>
							</View>
						) : (
							// Follows the finger, so the further you slide the closer it reads
							// to letting go of the take.
							<View style={[styles.slideHint, { opacity: 1 - slideProgress * 0.4 }]}>
								<Feather name='chevron-left' size={14} color={theme.colors.textMuted} />
								<Text style={[styles.slideText, { color: theme.colors.textMuted }]}>
									Slide to cancel · up to lock
								</Text>
							</View>
						)}
					</View>
				) : (
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
				)}

				{recording ? (
					<Pressable
						onPress={() => {
							setLocked(false)
							handsFreeRef.current = false
							recorderRef.current?.onCancel()
						}}
						accessibilityRole='button'
						accessibilityLabel='Cancel recording'
						style={[styles.iconButton, keyboardVisible && styles.iconButtonKeyboardOpen]}
						hitSlop={8}
					>
						<Feather name='trash-2' size={20} color={theme.colors.danger} />
					</Pressable>
				) : (
					<Pressable
						onPress={sendingLocked ? undefined : onSendAttachment}
						accessibilityRole='button'
						accessibilityLabel='Attach a file'
						style={[
							styles.iconButton,
							keyboardVisible && styles.iconButtonKeyboardOpen,
							sendingLocked && styles.buttonDisabled,
						]}
						hitSlop={8}
					>
						<Feather
							name='paperclip'
							size={21}
							color={theme.colors.textSecondary}
						/>
					</Pressable>
				)}

				{/* One button carries the whole right-hand side, the way Telegram's does:
				    it sends while there is text, and is the recorder while there is not.
				    A long press swaps the recorder between voice and video note. */}
				{locked ? (
					<Pressable
						accessibilityRole='button'
						accessibilityLabel='Send recording'
						onPress={() => {
							setLocked(false)
							handsFreeRef.current = false
							recorderRef.current?.onStop()
						}}
						style={[styles.sendButton, { backgroundColor: theme.colors.accent }]}
					>
						<Feather name='arrow-up' size={19} color={theme.colors.onAccent} />
					</Pressable>
				) : (
				<View
					{...actionGesture.panHandlers}
					accessible
					accessibilityRole='button'
					accessibilityState={{ disabled: sendingLocked }}
					accessibilityLabel={
						hasText
							? 'Send message'
							: recording
							? 'Stop recording'
							: recorder?.mode === 'video'
							? 'Record a video note'
							: 'Record a voice message'
					}
					accessibilityHint={
						hasText || recording
							? undefined
							: 'Hold to record. Tap to switch between voice and video note.'
					}
					style={[
						styles.sendButton,
						keyboardVisible && styles.sendButtonKeyboardOpen,
						{
							backgroundColor: recording
								? theme.colors.danger
								: hasText && !sendingLocked
								? theme.colors.accent
								: theme.colors.glassHover,
						},
						sendingLocked && styles.buttonDisabled,
					]}
				>
					<Feather
						name={
							hasText
								? 'arrow-up'
								: recording
								? 'square'
								: recorder?.mode === 'video'
								? 'video'
								: 'mic'
						}
						size={19}
						color={
							recording
								? '#FFFFFF'
								: hasText && !sendingLocked
								? theme.colors.onAccent
								: theme.colors.textSecondary
						}
					/>
				</View>
				)}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		backgroundColor: 'transparent',
		gap: 6,
		paddingBottom: 5,
		paddingHorizontal: 8,
		paddingTop: 5,
	},
	composerShell: {
		alignItems: 'flex-end',
		flexDirection: 'row',
		minHeight: 38,
		paddingLeft: 2,
		paddingRight: 2,
	},
	composerShellWeb: {
		alignItems: 'center',
	},
	composerShellKeyboardOpen: {
		paddingVertical: 2,
	},
	iconButton: {
		alignItems: 'center',
		borderRadius: 15,
		height: 30,
		justifyContent: 'center',
		width: 30,
	},
	iconButtonKeyboardOpen: {
		alignSelf: 'center',
	},
	inputWrap: {
		flex: 1,
		justifyContent: 'center',
		marginHorizontal: 2,
		minHeight: 30,
	},
	inputWrapKeyboardOpen: {
		minHeight: 30,
	},
	inputWrapWeb: {
		minHeight: 30,
	},
	input: {
		flex: 1,
		fontSize: 16,
		letterSpacing: -0.32,
		lineHeight: 20,
		maxHeight: 84,
		minHeight: 20,
		paddingBottom: Platform.OS === 'ios' ? 2 : 0,
		paddingHorizontal: 6,
		paddingTop: 0,
		textAlignVertical: 'center',
	},
	inputWeb: {
		paddingBottom: 2,
		paddingTop: 2,
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
		borderRadius: 15,
		height: 30,
		justifyContent: 'center',
		marginLeft: 2,
		width: 30,
	},
	sendButtonKeyboardOpen: {
		alignSelf: 'center',
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	emojiPanel: {
		borderRadius: 18,
		borderWidth: 1,
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		padding: 8,
	},
	mediaActionsWrap: {
		paddingHorizontal: 4,
	},
	viewfinderWrap: {
		alignItems: 'center',
		borderWidth: StyleSheet.hairlineWidth * 2,
		bottom: '100%',
		flexDirection: 'row',
		gap: 10,
		left: 4,
		marginBottom: 8,
		padding: 8,
		position: 'absolute',
	},
	viewfinderControls: {
		flexDirection: 'row',
		gap: 8,
	},
	viewfinderButton: {
		alignItems: 'center',
		borderRadius: 999,
		height: 34,
		justifyContent: 'center',
		width: 34,
	},
	recordingWrap: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 8,
		marginHorizontal: 3,
		minHeight: 30,
		paddingHorizontal: 6,
	},
	recordingDot: {
		borderRadius: 999,
		height: 9,
		width: 9,
	},
	recordingText: {
		fontSize: 15,
		fontWeight: '600',
		letterSpacing: -0.2,
		minWidth: 40,
	},
	slideHint: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 2,
		justifyContent: 'flex-end',
	},
	lockedHint: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 4,
		justifyContent: 'flex-end',
	},
	slideText: {
		fontSize: 12,
		fontWeight: '600',
	},
	editingBanner: {
		alignItems: 'center',
		borderRadius: 14,
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
		fontSize: 13,
		fontWeight: '600',
		letterSpacing: -0.08,
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
