import { Feather } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	ActionSheetIOS,
	Alert,
	Animated,
	Dimensions,
	Easing,
	Keyboard,
	KeyboardAvoidingView,
	PanResponder,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
	type KeyboardEvent,
	type LayoutChangeEvent,
} from 'react-native'
import { FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChatComposer, MessageBubble, TypingIndicator } from '@/components/chat'
import { Avatar } from '@/components/common/Avatar'
import { EmptyState } from '@/components/common/EmptyState'
import { CALL_ROUTE_CONFIG } from '@/features/calls/config/callConfig'
import {
	MediaMessageComposerActions,
	useSendMediaMessage,
	useVideoNoteRecorder,
	useVoiceMessageRecorder,
	type PreparedMediaDraft,
} from '@/features/chat/media-messages'
import { useAppToast } from '@/hooks/useAppToast'
import { useAppTheme } from '@/hooks/useAppTheme'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ApiRequestError } from '@/services/api/httpClient'
import { useCallsStore } from '@/store/callsStore'
import { useChatStore } from '@/store/chatStore'
import type { CallType, ChatMessage, ChatSummary } from '@/types'
import { formatRelative } from '@/utils/date'
import { useShallow } from 'zustand/react/shallow'

interface ConversationPanelProps {
	chatId: string
	compact?: boolean
}

const getChatTitleAvatar = (
	chat: ChatSummary,
	currentUserId: string,
	users: ReturnType<typeof useChatStore.getState>['users'],
) => {
	if (chat.kind !== 'direct') {
		return { title: chat.title, avatar: chat.avatar }
	}
	const peer = users.find(
		user => chat.memberIds.includes(user.id) && user.id !== currentUserId,
	)
	return { title: peer?.fullName ?? chat.title, avatar: peer?.avatar }
}

const formatFileSize = (size?: number): string => {
	if (!size || Number.isNaN(size)) {
		return 'Unknown size'
	}
	if (size < 1024) {
		return `${size} B`
	}
	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`
	}
	return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
const LIVE_CALL_STATUSES = new Set([
	'calling',
	'ringing',
	'connecting',
	'connected',
])

const getAttachmentErrorMessage = (error: unknown): string => {
	if (error instanceof ApiRequestError) {
		if (error.status === 401) {
			return 'Session expired. Please log in again.'
		}
		if (error.status === 413) {
			return 'File is too large. Max allowed size is 25 MB.'
		}
		if (error.status === 503) {
			return 'Upload service is not configured.'
		}
		if (error.status === 502) {
			return 'Upload provider failed. Please retry.'
		}
		return error.message
	}
	if (error instanceof Error) {
		return error.message
	}
	return 'Network error while uploading. Please retry.'
}

export function ConversationPanel({
	chatId,
	compact = false,
}: ConversationPanelProps): JSX.Element {
	const router = useRouter()
	const { theme } = useAppTheme()
	const insets = useSafeAreaInsets()
	const toast = useAppToast()
	const currentUser = useCurrentUser()
	const listRef = useRef<FlatList<ChatMessage>>(null)
	const composerRef = useRef<View>(null)
	const keyboardVisibleRef = useRef(false)
	const baselineBottomInsetRef = useRef(insets.bottom)
	const baselineComposerBottomRef = useRef<number | null>(null)
	const webViewportHeightRef = useRef<number | null>(null)
	const webViewportSignatureRef = useRef('')
	const ignoreNextScrollEventRef = useRef(false)
	const composerTranslateY = useRef(new Animated.Value(0)).current
	const [selectedMessageId, setSelectedMessageId] = useState<string>('')
	const [composerBottomInset, setComposerBottomInset] = useState(insets.bottom)
	const [composerHeight, setComposerHeight] = useState(72)
	const [keyboardVisible, setKeyboardVisible] = useState(false)
	const [entryUnreadCount, setEntryUnreadCount] = useState(0)
	const [entryFirstUnreadMessageId, setEntryFirstUnreadMessageId] = useState('')
	const [entryScrollReady, setEntryScrollReady] = useState(false)
	const [uploadingAttachment, setUploadingAttachment] = useState(false)
	const [editingMessageId, setEditingMessageId] = useState('')
	const [composerDraft, setComposerDraft] = useState('')
	const [newIncomingCount, setNewIncomingCount] = useState(0)
	const isNearBottomRef = useRef(true)
	const lastMessageIdRef = useRef('')
	const shouldRunInitialScrollRef = useRef(true)
	const swipeBackTriggeredRef = useRef(false)
	const shouldEnableSwipeBack = compact && Platform.OS !== 'web'
	const swipeBackResponder = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => false,
				onMoveShouldSetPanResponder: (_event, gestureState) => {
					if (!shouldEnableSwipeBack) {
						return false
					}
					const movedRight = gestureState.dx > 14
					const mostlyHorizontal =
						Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4
					const startedFromLeftEdge = gestureState.x0 < 42
					return movedRight && mostlyHorizontal && startedFromLeftEdge
				},
				onPanResponderGrant: () => {
					swipeBackTriggeredRef.current = false
				},
				onPanResponderMove: (_event, gestureState) => {
					if (!shouldEnableSwipeBack || swipeBackTriggeredRef.current) {
						return
					}
					if (gestureState.dx > 86 && Math.abs(gestureState.dy) < 52) {
						swipeBackTriggeredRef.current = true
						router.back()
					}
				},
				onPanResponderRelease: () => {
					swipeBackTriggeredRef.current = false
				},
				onPanResponderTerminate: () => {
					swipeBackTriggeredRef.current = false
				},
			}),
		[router, shouldEnableSwipeBack],
	)

	const scrollToBottom = useCallback((animated: boolean, ensure = false) => {
		const run = (withAnimation: boolean) => {
			listRef.current?.scrollToEnd({ animated: withAnimation })
		}

		requestAnimationFrame(() => {
			ignoreNextScrollEventRef.current = true

			run(animated)

			setTimeout(() => {
				run(false)
			}, 80)

			if (ensure) {
				setTimeout(() => {
					run(false)
				}, 180)

				setTimeout(() => {
					run(false)
				}, 320)

				setTimeout(() => {
					run(false)
				}, 480)
			}

			setTimeout(() => {
				ignoreNextScrollEventRef.current = false
			}, 560)
		})
	}, [])

	const {
		chats,
		users,
		messages,
		sendMessage,
		editMessage,
		deleteMessage,
		setActiveConversationId,
		markConversationRead,
		sendTypingEvent,
		loadOlderMessages,
	} = useChatStore(
		useShallow(state => ({
			chats: state.chats,
			users: state.users,
			messages: state.messagesByChat[chatId] ?? [],
			sendMessage: state.sendMessage,
			editMessage: state.editMessage,
			deleteMessage: state.deleteMessage,
			setActiveConversationId: state.setActiveConversationId,
			markConversationRead: state.markConversationRead,
			sendTypingEvent: state.sendTypingEvent,
			loadOlderMessages: state.loadOlderMessages,
		})),
	)

	const chat = chats.find(item => item.id === chatId)
	const activeCall = useCallsStore(state => state.currentCall)
	const startCall = useCallsStore(state => state.startCall)
	const voiceRecorder = useVoiceMessageRecorder()
	const videoRecorder = useVideoNoteRecorder()
	const mediaSender = useSendMediaMessage({
		chatId,
		sendMessage,
	})
	const editingMessage = useMemo(
		() => messages.find(message => message.id === editingMessageId) ?? null,
		[editingMessageId, messages],
	)

	useFocusEffect(
		useCallback(() => {
			setEntryScrollReady(false)
			setNewIncomingCount(0)
			const state = useChatStore.getState()
			const unreadAtEntry =
				state.chats.find(item => item.id === chatId)?.unreadCount ?? 0
			const effectiveUnreadCount = unreadAtEntry >= 2 ? unreadAtEntry : 0
			const entryMessages = state.messagesByChat[chatId] ?? []
			const unreadStartIndex =
				effectiveUnreadCount > 0
					? Math.max(entryMessages.length - effectiveUnreadCount, 0)
					: -1
			const unreadStartMessageId =
				unreadStartIndex >= 0 ? (entryMessages[unreadStartIndex]?.id ?? '') : ''
			setEntryUnreadCount(effectiveUnreadCount)
			setEntryFirstUnreadMessageId(unreadStartMessageId)
			shouldRunInitialScrollRef.current = true
			setActiveConversationId(chatId)
			markConversationRead(chatId)
			return () => {
				sendTypingEvent(chatId, false)
				setActiveConversationId('')
				setEntryUnreadCount(0)
				setEntryFirstUnreadMessageId('')
				setEntryScrollReady(false)
				setNewIncomingCount(0)
			}
		}, [
			chatId,
			markConversationRead,
			sendTypingEvent,
			setActiveConversationId,
		]),
	)

	const cancelVoiceRecorder = voiceRecorder.cancel
	const cancelVideoRecorder = videoRecorder.cancel
	const resetMediaSender = mediaSender.reset

	useEffect(
		() => () => {
			cancelVoiceRecorder().catch(() => undefined)
			cancelVideoRecorder().catch(() => undefined)
			resetMediaSender()
		},
		[cancelVoiceRecorder, cancelVideoRecorder, resetMediaSender],
	)

	const loadingOlder = useChatStore(
		state => state.loadingOlderByChat[chatId] ?? false,
	)
	const loadedMessageLimit = useChatStore(
		state => state.loadedMessageLimitByChat[chatId] ?? 0,
	)

	useEffect(() => {
		if (!chatId || entryScrollReady || loadingOlder) {
			return
		}
		if (loadedMessageLimit > 0) {
			setEntryScrollReady(true)
			return
		}
		loadOlderMessages(chatId)
			.catch(() => undefined)
			.finally(() => setEntryScrollReady(true))
	}, [
		chatId,
		entryScrollReady,
		loadOlderMessages,
		loadedMessageLimit,
		loadingOlder,
	])

	useEffect(() => {
		if (!entryScrollReady) {
			return
		}

		const nextLastMessage = messages[messages.length - 1]
		if (!nextLastMessage) {
			lastMessageIdRef.current = ''
			return
		}

		if (shouldRunInitialScrollRef.current) {
			if (entryUnreadCount > 0) {
				const unreadIndexById = entryFirstUnreadMessageId
					? messages.findIndex(
							message => message.id === entryFirstUnreadMessageId,
						)
					: -1
				const fallbackUnreadIndex = Math.max(
					messages.length - entryUnreadCount,
					0,
				)
				const unreadIndex =
					unreadIndexById >= 0
						? unreadIndexById
						: messages[fallbackUnreadIndex]
							? fallbackUnreadIndex
							: -1
				if (unreadIndex >= 0) {
					requestAnimationFrame(() => {
						ignoreNextScrollEventRef.current = true
						listRef.current?.scrollToIndex({
							index: Math.max(unreadIndex - 1, 0),
							animated: false,
							viewPosition: 0.1,
						})
						setTimeout(() => {
							ignoreNextScrollEventRef.current = false
						}, 120)
					})
					isNearBottomRef.current = false
				} else {
					scrollToBottom(false, true)
					isNearBottomRef.current = true
				}
			} else {
				scrollToBottom(false, true)
				isNearBottomRef.current = true
			}

			shouldRunInitialScrollRef.current = false
			lastMessageIdRef.current = nextLastMessage.id
			return
		}

		const previousMessageId = lastMessageIdRef.current
		lastMessageIdRef.current = nextLastMessage.id

		if (!previousMessageId) {
			return
		}
		if (previousMessageId === nextLastMessage.id) {
			return
		}

		const incomingFromOtherUser =
			nextLastMessage.senderId !== currentUser.id &&
			nextLastMessage.senderId !== 'system'

		const shouldStickToBottom =
			isNearBottomRef.current || nextLastMessage.senderId === currentUser.id
		if (!shouldStickToBottom) {
			if (incomingFromOtherUser) {
				setNewIncomingCount(count => count + 1)
			}
			return
		}

		setNewIncomingCount(0)
		scrollToBottom(true)
	}, [
		currentUser.id,
		entryFirstUnreadMessageId,
		entryUnreadCount,
		entryScrollReady,
		messages,
		scrollToBottom,
	])

	useEffect(() => {
		if (messages.length === 0) {
			return
		}
		markConversationRead(chatId)
	}, [chatId, markConversationRead, messages.length])

	useEffect(() => {
		if (!editingMessageId) {
			return
		}
		if (
			editingMessage &&
			editingMessage.type === 'text' &&
			editingMessage.senderId === currentUser.id &&
			!editingMessage.isDeleted
		) {
			return
		}
		setEditingMessageId('')
		setComposerDraft('')
	}, [currentUser.id, editingMessage, editingMessageId])

	useEffect(() => {
		if (!entryScrollReady) {
			return
		}
		if (entryUnreadCount > 0) {
			return
		}
		if (!isNearBottomRef.current) {
			return
		}
		scrollToBottom(false, true)
	}, [
		composerBottomInset,
		composerHeight,
		entryScrollReady,
		entryUnreadCount,
		keyboardVisible,
		scrollToBottom,
	])

	useEffect(() => {
		const animateComposer = (toValue: number, duration: number) => {
			Animated.timing(composerTranslateY, {
				toValue,
				duration,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}).start()
		}

		const measureComposerBottom = (callback: (bottom: number) => void) => {
			requestAnimationFrame(() => {
				composerRef.current?.measureInWindow((_x, y, _w, h) => {
					callback(y + h)
				})
			})
		}

		const isEditableTarget = (target: EventTarget | null): boolean => {
			if (
				typeof HTMLElement === 'undefined' ||
				!(target instanceof HTMLElement)
			) {
				return false
			}
			const tag = target.tagName.toLowerCase()
			return tag === 'input' || tag === 'textarea' || target.isContentEditable
		}

		const shouldSkipAndroidComposerLift = (event: KeyboardEvent): boolean => {
			if (Platform.OS !== 'android') {
				return false
			}

			const screenHeight = Dimensions.get('screen').height
			const windowHeight = Dimensions.get('window').height
			const keyboardHeight = event.endCoordinates?.height ?? 0
			const windowInset = Math.max(0, screenHeight - windowHeight)

			if (keyboardHeight <= 0) {
				return windowInset > 80
			}

			return windowInset >= Math.max(80, keyboardHeight * 0.35)
		}

		const syncWebViewport = () => {
			if (Platform.OS !== 'web' || typeof window === 'undefined') {
				return
			}

			const viewport = (
				window as {
					visualViewport?: {
						height: number
						offsetTop: number
					}
				}
			).visualViewport

			const viewportHeight = viewport?.height ?? window.innerHeight
			const viewportBottom = viewport
				? viewport.offsetTop + viewport.height
				: window.innerHeight
			const viewportSignature = `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`
			const activeElement =
				typeof document === 'undefined' ? null : document.activeElement
			const inputFocused = isEditableTarget(activeElement)
			const signatureChanged =
				webViewportSignatureRef.current !== viewportSignature

			if (signatureChanged) {
				webViewportSignatureRef.current = viewportSignature
				if (!inputFocused) {
					webViewportHeightRef.current = viewportHeight
				}
			}

			if (webViewportHeightRef.current == null) {
				webViewportHeightRef.current = viewportHeight
			}

			const baselineViewport = webViewportHeightRef.current ?? viewportHeight
			const viewportDrop = Math.max(0, baselineViewport - viewportHeight)

			measureComposerBottom(currentBottom => {
				const baselineBottom =
					baselineComposerBottomRef.current ?? currentBottom
				const referenceBottom = Math.max(currentBottom, baselineBottom)
				const overlap = Math.max(0, referenceBottom - viewportBottom)
				const keyboardIsVisible =
					inputFocused && (overlap > 0 || viewportDrop > 90)
				const duration = keyboardIsVisible ? 110 : 160

				setKeyboardVisible(keyboardIsVisible)
				keyboardVisibleRef.current = keyboardIsVisible
				setComposerBottomInset(
					keyboardIsVisible ? 0 : baselineBottomInsetRef.current,
				)
				animateComposer(keyboardIsVisible ? -overlap : 0, duration)

				if (keyboardIsVisible && isNearBottomRef.current) {
					requestAnimationFrame(() => {
						listRef.current?.scrollToEnd({ animated: false })
					})
				}

				if (!keyboardIsVisible) {
					webViewportHeightRef.current = viewportHeight
					baselineComposerBottomRef.current = currentBottom
				}
			})
		}

		if (Platform.OS === 'web') {
			if (typeof window === 'undefined') {
				return
			}
			const viewport = (
				window as {
					visualViewport?: {
						height: number
						addEventListener: (
							name: 'resize' | 'scroll',
							listener: () => void,
						) => void
						removeEventListener: (
							name: 'resize' | 'scroll',
							listener: () => void,
						) => void
					}
				}
			).visualViewport

			const onWindowResize = () => {
				syncWebViewport()
			}
			const onFocusChange = () => {
				setTimeout(syncWebViewport, 0)
			}

			webViewportHeightRef.current = viewport?.height ?? window.innerHeight
			webViewportSignatureRef.current = `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`
			requestAnimationFrame(syncWebViewport)

			viewport?.addEventListener('resize', syncWebViewport)
			viewport?.addEventListener('scroll', syncWebViewport)
			window.addEventListener('resize', onWindowResize)
			window.addEventListener('orientationchange', onWindowResize)
			if (typeof document !== 'undefined') {
				document.addEventListener('focusin', onFocusChange)
				document.addEventListener('focusout', onFocusChange)
			}
			return () => {
				viewport?.removeEventListener('resize', syncWebViewport)
				viewport?.removeEventListener('scroll', syncWebViewport)
				window.removeEventListener('resize', onWindowResize)
				window.removeEventListener('orientationchange', onWindowResize)
				if (typeof document !== 'undefined') {
					document.removeEventListener('focusin', onFocusChange)
					document.removeEventListener('focusout', onFocusChange)
				}
			}
		}

		const handleKeyboardShow = (event: KeyboardEvent) => {
			setKeyboardVisible(true)
			if (isNearBottomRef.current) {
				requestAnimationFrame(() => {
					listRef.current?.scrollToEnd({ animated: true })
				})
			}

			keyboardVisibleRef.current = true
			setComposerBottomInset(0)
			const duration =
				typeof event.duration === 'number' && event.duration > 0
					? event.duration
					: 220

			if (shouldSkipAndroidComposerLift(event)) {
				animateComposer(0, duration)
				return
			}

			const keyboardTop =
				event.endCoordinates?.screenY ??
				Dimensions.get('window').height - (event.endCoordinates?.height ?? 0)

			measureComposerBottom(currentBottom => {
				const baselineBottom =
					baselineComposerBottomRef.current ?? currentBottom
				const referenceBottom =
					Platform.OS === 'android'
						? currentBottom
						: Math.max(currentBottom, baselineBottom)
				const overlap = referenceBottom - keyboardTop
				animateComposer(overlap > 0 ? -overlap : 0, duration)
			})
		}

		const handleKeyboardHide = (event: KeyboardEvent) => {
			setKeyboardVisible(false)
			keyboardVisibleRef.current = false
			setComposerBottomInset(baselineBottomInsetRef.current)
			const duration =
				typeof event.duration === 'number' && event.duration > 0
					? event.duration
					: 180
			animateComposer(0, duration)

			if (isNearBottomRef.current) {
				requestAnimationFrame(() => {
					listRef.current?.scrollToEnd({ animated: false })
				})
			}
			if (Platform.OS === 'android') {
				measureComposerBottom(bottom => {
					baselineComposerBottomRef.current = bottom
				})
			}
		}

		const showEvent =
			Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
		const hideEvent =
			Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
		const showSub = Keyboard.addListener(showEvent, handleKeyboardShow)
		const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide)

		return () => {
			showSub.remove()
			hideSub.remove()
		}
	}, [composerTranslateY])

	useEffect(() => {
		baselineBottomInsetRef.current = insets.bottom
		if (Platform.OS !== 'android') {
			if (!keyboardVisibleRef.current) {
				setComposerBottomInset(insets.bottom)
			}
			return
		}

		if (keyboardVisibleRef.current) {
			return
		}

		setComposerBottomInset(insets.bottom)

		requestAnimationFrame(() => {
			composerRef.current?.measureInWindow((_x, y, _w, h) => {
				baselineComposerBottomRef.current = y + h
			})
		})
	}, [insets.bottom])

	useEffect(() => {
		if (voiceRecorder.state.step === 'error' && voiceRecorder.state.errorMessage) {
			toast.error('Voice recorder', voiceRecorder.state.errorMessage)
		}
	}, [toast, voiceRecorder.state.errorMessage, voiceRecorder.state.step])

	useEffect(() => {
		if (videoRecorder.state.step === 'error' && videoRecorder.state.errorMessage) {
			toast.error('Video recorder', videoRecorder.state.errorMessage)
		}
	}, [toast, videoRecorder.state.errorMessage, videoRecorder.state.step])

	if (!chat) {
		return (
			<View
				style={[styles.emptyWrap, { backgroundColor: theme.colors.background }]}
			>
				<EmptyState
					title='Conversation not found'
					description='Select another chat from the list.'
					icon='message-circle'
				/>
			</View>
		)
	}

	const header = getChatTitleAvatar(chat, currentUser.id, users)

	const canEditMessage = (message: ChatMessage): boolean =>
		message.type === 'text' &&
		!message.isDeleted &&
		message.senderId === currentUser.id

	const canDeleteMessage = (message: ChatMessage): boolean =>
		!message.isDeleted && message.senderId === currentUser.id

	const runMessageAction = (
		message: ChatMessage,
		action: 'edit' | 'delete',
	) => {
		if (action === 'edit') {
			if (!canEditMessage(message)) {
				toast.info(
					'Edit restricted',
					'Only text messages can be edited.',
				)
				return
			}
			setEditingMessageId(message.id)
			setComposerDraft(message.body)
			setSelectedMessageId('')
			return
		}
		if (!canDeleteMessage(message)) {
			toast.error('Delete restricted', 'This message cannot be deleted.')
			return
		}
		if (editingMessageId === message.id) {
			setEditingMessageId('')
			setComposerDraft('')
		}
		deleteMessage(chat.id, message.id)
		toast.success('Message deleted')
		setSelectedMessageId('')
	}

	const closeMessageActions = () => {
		setSelectedMessageId('')
	}

	const openMessageActions = (message: ChatMessage) => {
		if (Platform.OS === 'web') {
			setSelectedMessageId(current =>
				current === message.id ? '' : message.id,
			)
			return
		}

		const options: string[] = []
		const handlers: ((() => void) | null)[] = []
		const editAllowed = canEditMessage(message)
		const deleteAllowed = canDeleteMessage(message)

		if (editAllowed) {
			options.push('Edit')
			handlers.push(() => runMessageAction(message, 'edit'))
		}
		if (deleteAllowed) {
			options.push('Delete')
			handlers.push(() => runMessageAction(message, 'delete'))
		}
		options.push('Cancel')
		handlers.push(null)

		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					options,
					destructiveButtonIndex: deleteAllowed ? options.indexOf('Delete') : undefined,
					cancelButtonIndex: options.length - 1,
				},
				index => {
					handlers[index]?.()
				},
			)
			return
		}

		const alertActions = options.map(option => {
			if (option === 'Delete') {
				return {
					text: option,
					style: 'destructive' as const,
					onPress: () => runMessageAction(message, 'delete'),
				}
			}
			if (option === 'Edit') {
				return {
					text: option,
					onPress: () => runMessageAction(message, 'edit'),
				}
			}
			return { text: option, style: 'cancel' as const }
		})
		Alert.alert('Message Actions', 'Choose an action', alertActions)
	}

	const typingMembers = users.filter(
		user => chat.typingUserIds.includes(user.id) && user.id !== currentUser.id,
	)
	const typingFirstNames = typingMembers.map(
		user => user.fullName.split(' ')[0] ?? user.fullName,
	)
	const typingLabel =
		typingFirstNames.length > 0
			? `${typingFirstNames[0]} typing`
			: 'Typing'
	const directPeer =
		chat.kind === 'direct'
			? users.find(
					user => chat.memberIds.includes(user.id) && user.id !== currentUser.id,
				)
			: undefined
	const headerSubtitle =
		chat.kind === 'direct'
			? directPeer?.isOnline
				? 'Online'
				: directPeer?.lastSeenAt
					? (() => {
							try {
								return `Last seen ${formatRelative(directPeer.lastSeenAt)}`
							} catch {
								return 'Offline'
							}
						})()
					: 'Offline'
			: `${chat.memberIds.length} members`
	const unreadMarkerIndex =
		entryUnreadCount > 0 && entryFirstUnreadMessageId
			? messages.findIndex(message => message.id === entryFirstUnreadMessageId)
			: -1
	const openChatInfo = () => {
		router.push({
			pathname: '/(app)/chat-info/[chatId]',
			params: { chatId: chat.id },
		})
	}
	const refreshChatMessages = () => {
		if (loadingOlder) {
			return
		}
		loadOlderMessages(chat.id)
			.then(() => {
				toast.success('Chat refreshed')
			})
			.catch(error => {
				toast.error(
					'Unable to refresh chat',
					error instanceof Error ? error.message : 'Unexpected error',
				)
			})
	}
	const openCallSession = (callId: string) => {
		router.push({
			pathname: CALL_ROUTE_CONFIG.detailsPathname as never,
			params: { callId } as never,
		})
	}

	const beginCall = (callType: CallType) => {
		if (
			activeCall &&
			LIVE_CALL_STATUSES.has(activeCall.status) &&
			activeCall.conversationId !== chat.id
		) {
			toast.info(
				'Call already in progress',
				'Finish the current call before starting a new one.',
			)
			return
		}
		if (activeCall && LIVE_CALL_STATUSES.has(activeCall.status)) {
			openCallSession(activeCall.id)
			return
		}
		startCall({
			conversationId: chat.id,
			callType,
		})
			.then(callId => {
				toast.info(
					callType === 'video' ? 'Starting video call' : 'Starting audio call',
					header.title,
				)
				openCallSession(callId)
			})
			.catch(error => {
				toast.error(
					'Unable to start call',
					error instanceof Error ? error.message : 'Unexpected error',
				)
			})
	}

	const handleAttachmentPick = async () => {
		if (uploadingAttachment || mediaSender.isSending) {
			return
		}
		if (activeMediaDraft) {
			toast.info(
				'Draft ready',
				'Send or discard the recorded media before attaching another file.',
			)
			return
		}
		try {
			const result = await DocumentPicker.getDocumentAsync({
				multiple: false,
				copyToCacheDirectory: true,
			})

			if (result.canceled || result.assets.length === 0) {
				return
			}

			const file = result.assets[0]
			if (!file) {
				return
			}
			if (typeof file.size === 'number' && file.size > MAX_ATTACHMENT_BYTES) {
				toast.error('Unable to send file', 'File is too large. Max allowed size is 25 MB.')
				return
			}
			const mimeType = file.mimeType ?? 'application/octet-stream'
			const messageType = mimeType.startsWith('image/') ? 'image' : 'file'
			const webFile =
				Platform.OS === 'web'
					? (file as unknown as { file?: Blob }).file
					: undefined
			setUploadingAttachment(true)
			await sendMessage({
				chatId: chat.id,
				body: file.name,
				type: messageType,
				attachment: {
					id: `attachment_${Date.now()}`,
					name: file.name,
					sizeLabel: formatFileSize(file.size),
					sizeBytes: file.size,
					mimeType,
					uri: file.uri,
					webFile,
					originalName: file.name,
					publicUrl: null,
				},
			})
			toast.success('File sent', file.name)
		} catch (error) {
			toast.error('Unable to send file', getAttachmentErrorMessage(error))
		} finally {
			setUploadingAttachment(false)
		}
	}

	const sendMediaDraft = async (draft: PreparedMediaDraft) => {
		const result = await mediaSender.sendDraft(draft)
		if (!result.ok) {
			toast.error(
				'Unable to send media message',
				result.errorMessage ??
					mediaSender.state.errorMessage ??
					'Please try again.',
			)
			return
		}
		toast.success(
			draft.type === 'voice' ? 'Voice message sent' : 'Video note sent',
		)
		voiceRecorder.reset()
		videoRecorder.reset()
		mediaSender.reset()
		isNearBottomRef.current = true
	}

	const handleVoiceRecordPress = () => {
		if (voiceRecorder.isRecording) {
			voiceRecorder.stop().catch(() => undefined)
			return
		}
		voiceRecorder.start().catch(() => undefined)
	}

	const handleVideoRecordPress = () => {
		if (videoRecorder.needsStopAction) {
			videoRecorder.stop().catch(() => undefined)
			return
		}
		videoRecorder.start().catch(() => undefined)
	}

	const handleComposerLayout = (event: LayoutChangeEvent) => {
		const nextHeight = event.nativeEvent.layout.height
		if (nextHeight !== composerHeight) {
			setComposerHeight(nextHeight)
		}
		if (Platform.OS !== 'android' || keyboardVisibleRef.current) {
			return
		}
		requestAnimationFrame(() => {
			composerRef.current?.measureInWindow((_x, y, _w, h) => {
				baselineComposerBottomRef.current = y + h
			})
		})
	}

	const typingIndicatorReserve = typingMembers.length > 0 ? 44 : 0
	const listBottomGap = (keyboardVisible ? 24 : 8) + typingIndicatorReserve
	const activeMediaDraft = videoRecorder.draft ?? voiceRecorder.draft
	const isEditingMessage = editingMessageId.length > 0
	const composerLocked =
		uploadingAttachment ||
		mediaSender.isSending ||
		voiceRecorder.isBusy ||
		videoRecorder.isBusy
	const cancelInlineEdit = () => {
		setEditingMessageId('')
		setComposerDraft('')
	}

	return (
		<KeyboardAvoidingView
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			enabled={Platform.OS === 'ios'}
			behavior='padding'
			keyboardVerticalOffset={0}
			{...(shouldEnableSwipeBack ? swipeBackResponder.panHandlers : {})}
		>
			<View
				style={[
					styles.header,
					{
						backgroundColor: theme.colors.surface,
						borderBottomColor: theme.colors.border,
					},
				]}
			>
				<View style={styles.headerLeft}>
					{compact ? (
						<Pressable
							onPress={() => {
								if (Platform.OS === 'web') {
									router.replace('/(app)/(tabs)/chats')
									return
								}
								router.back()
							}}
							style={styles.backBtn}
							hitSlop={8}
						>
							<Feather
								name='chevron-left'
								size={20}
								color={theme.colors.textPrimary}
							/>
						</Pressable>
					) : null}

					<Pressable
						onPress={openChatInfo}
						accessibilityRole='button'
						accessibilityLabel={`Open details for ${header.title}`}
						style={({ pressed }) => [
							styles.headerTapTarget,
							{
								backgroundColor: pressed
									? theme.colors.surfaceMuted
									: 'transparent',
							},
						]}
					>
						<Avatar uri={header.avatar} name={header.title} size={40} />
						<View style={styles.headerCopy}>
							<Text
								numberOfLines={1}
								style={[
									styles.headerTitle,
									{ color: theme.colors.textPrimary },
								]}
							>
								{header.title}
							</Text>
							<View style={styles.headerSubtitleRow}>
								{chat.kind === 'direct' ? (
									<View
										style={[
											styles.presenceDot,
											{
												backgroundColor: directPeer?.isOnline
													? theme.colors.online
													: theme.colors.textMuted,
											},
										]}
									/>
								) : null}
								<Text
									numberOfLines={1}
									style={[
										styles.headerSubtitle,
										{ color: theme.colors.textMuted },
									]}
								>
									{headerSubtitle}
								</Text>
							</View>
						</View>
						<Feather
							name='chevron-right'
							size={16}
							color={theme.colors.textMuted}
						/>
					</Pressable>
				</View>
				<View style={styles.headerActions}>
					<Pressable
						onPress={refreshChatMessages}
						disabled={loadingOlder}
						accessibilityRole='button'
						accessibilityLabel='Refresh chat messages'
						style={({ pressed }) => [
							styles.actionButton,
							{
								opacity: loadingOlder ? 0.55 : 1,
								backgroundColor: pressed
									? theme.colors.accentMuted
									: theme.colors.surfaceMuted,
							},
						]}
					>
						<Feather
							name={loadingOlder ? 'loader' : 'refresh-cw'}
							size={16}
							color={theme.colors.textSecondary}
						/>
					</Pressable>
					<Pressable
						onPress={() => beginCall('audio')}
						accessibilityRole='button'
						accessibilityLabel='Start audio call'
						style={({ pressed }) => [
							styles.actionButton,
							{
								backgroundColor: pressed
									? theme.colors.accentMuted
									: theme.colors.surfaceMuted,
							},
						]}
					>
						<Feather
							name='phone'
							size={16}
							color={theme.colors.textSecondary}
						/>
					</Pressable>
					<Pressable
						onPress={() => beginCall('video')}
						accessibilityRole='button'
						accessibilityLabel='Start video call'
						style={({ pressed }) => [
							styles.actionButton,
							{
								backgroundColor: pressed
									? theme.colors.accentMuted
									: theme.colors.surfaceMuted,
							},
						]}
					>
						<Feather
							name='video'
							size={16}
							color={theme.colors.textSecondary}
						/>
					</Pressable>
				</View>
			</View>

			<FlatList
				ref={listRef}
				data={messages}
				keyExtractor={item => item.id}
				style={{ flex: 1, backgroundColor: theme.colors.background }}
				scrollEventThrottle={16}
				keyboardShouldPersistTaps='handled'
				keyboardDismissMode={
					Platform.OS === 'ios'
						? 'interactive'
						: Platform.OS === 'web'
							? 'none'
							: 'on-drag'
				}
				onScroll={({ nativeEvent }) => {
					if (ignoreNextScrollEventRef.current) {
						return
					}
					if (selectedMessageId) {
						setSelectedMessageId('')
					}
					const distanceFromBottom =
						nativeEvent.contentSize.height -
						(nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height)
					const nearBottom = distanceFromBottom < 88
					isNearBottomRef.current = nearBottom
					if (nearBottom && newIncomingCount > 0) {
						setNewIncomingCount(0)
					}
				}}
				contentContainerStyle={[
					styles.messagesContainer,
					{
						backgroundColor: theme.colors.background,
						paddingBottom: 8,
					},
				]}
				ListFooterComponent={
					<View
						style={{
							height: composerHeight + listBottomGap,
						}}
					/>
				}
				ListEmptyComponent={
					<View style={styles.emptyStateWrap}>
						<EmptyState
							title='No messages yet'
							description='Start the conversation by sending your first message.'
							icon='message-square'
						/>
					</View>
				}
				onScrollToIndexFailed={({ averageItemLength, index }) => {
					const offset = Math.max(0, averageItemLength * index - 40)
					listRef.current?.scrollToOffset({ offset, animated: false })
					setTimeout(() => {
						listRef.current?.scrollToIndex({
							index: Math.max(index - 1, 0),
							animated: false,
							viewPosition: 0.05,
						})
					}, 60)
				}}
				renderItem={({ item, index }) => {
					const sender = users.find(user => user.id === item.senderId)
					return (
						<View>
							{index === unreadMarkerIndex && entryUnreadCount > 0 ? (
								<View style={styles.newMessagesDivider}>
									<View
										style={[
											styles.newMessagesLine,
											{ backgroundColor: theme.colors.border },
										]}
									/>
									<Text
										style={[
											styles.newMessagesText,
											{ color: theme.colors.accent },
										]}
									>
										New messages
									</Text>
									<View
										style={[
											styles.newMessagesLine,
											{ backgroundColor: theme.colors.border },
										]}
									/>
								</View>
							) : null}
							<MessageBubble
								message={item}
								senderName={
									item.senderId === 'system'
										? 'System'
										: (sender?.fullName ?? 'Unknown')
								}
								isMine={item.senderId === currentUser.id}
								onLongPress={
									Platform.OS === 'web' || !canDeleteMessage(item)
										? undefined
										: () => openMessageActions(item)
								}
								onOpenActions={
									canDeleteMessage(item) ? () => openMessageActions(item) : undefined
								}
								showActionsTooltip={
									Platform.OS === 'web' && selectedMessageId === item.id
								}
								canEdit={canEditMessage(item)}
								canDelete={canDeleteMessage(item)}
								onEdit={() => runMessageAction(item, 'edit')}
								onDelete={() => runMessageAction(item, 'delete')}
								onDismissActions={closeMessageActions}
							/>
						</View>
					)
				}}
				onContentSizeChange={() => {
					if (selectedMessageId) {
						setSelectedMessageId('')
					}
					if (isNearBottomRef.current) {
						scrollToBottom(false, true)
					}
				}}
				onLayout={() => {
					if (shouldRunInitialScrollRef.current && entryUnreadCount === 0) {
						isNearBottomRef.current = true
						scrollToBottom(false, true)
					}
				}}
			/>

			<Animated.View
				ref={composerRef}
				onLayout={handleComposerLayout}
				style={[
					styles.composerDock,
					{
						backgroundColor: theme.colors.surface,
						paddingBottom: composerBottomInset,
						transform: [{ translateY: composerTranslateY }],
					},
				]}
			>
				<ChatComposer
					keyboardVisible={keyboardVisible}
					sendingLocked={composerLocked}
					autoFocus={Platform.OS === 'web'}
					focusSignal={`${chatId}:${editingMessageId || 'new'}`}
					draftValue={composerDraft}
					onDraftChange={setComposerDraft}
					editingLabel={isEditingMessage ? 'Editing message' : undefined}
					onCancelEditing={cancelInlineEdit}
					mediaActionsSlot={
						isEditingMessage ? null : (
							<MediaMessageComposerActions
								voiceDraft={voiceRecorder.draft}
								videoDraft={videoRecorder.draft}
								voiceRecording={voiceRecorder.isRecording}
								voiceBusy={voiceRecorder.isBusy}
								videoRecording={videoRecorder.isRecording}
								videoNeedsStopAction={videoRecorder.needsStopAction}
								videoBusy={videoRecorder.isBusy}
								isSending={mediaSender.isSending}
								sendErrorMessage={mediaSender.state.errorMessage}
								onStartVoiceRecording={handleVoiceRecordPress}
								onStopVoiceRecording={handleVoiceRecordPress}
								onCancelVoiceRecording={() => {
									voiceRecorder.cancel().catch(() => undefined)
									mediaSender.reset()
								}}
								onStartVideoRecording={handleVideoRecordPress}
								onStopVideoRecording={handleVideoRecordPress}
								onCancelVideoRecording={() => {
									videoRecorder.cancel().catch(() => undefined)
									mediaSender.reset()
								}}
								onSendDraft={draft => {
									sendMediaDraft(draft).catch(() => undefined)
								}}
								onDiscardDraft={() => {
									voiceRecorder.reset()
									videoRecorder.reset()
									mediaSender.reset()
								}}
							/>
						)
					}
					onTypingStart={() => sendTypingEvent(chat.id, true)}
					onTypingStop={() => sendTypingEvent(chat.id, false)}
					onSend={body => {
						const nextText = body.trim()
						if (!nextText) {
							return
						}
						if (isEditingMessage) {
							editMessage(chat.id, editingMessageId, nextText)
								.then(() => {
									toast.success('Message updated')
									cancelInlineEdit()
								})
								.catch(error => {
									toast.error(
										'Unable to update message',
										error instanceof Error ? error.message : 'Unexpected error',
									)
								})
							return
						}
						if (activeMediaDraft) {
							toast.info(
								'Draft ready',
								'Send or discard the recorded media before sending text.',
							)
							return
						}
						sendMessage({
							chatId: chat.id,
							body: nextText,
							type: 'text',
						}).catch(error => {
							toast.error(
								'Unable to send message',
								error instanceof Error ? error.message : 'Unexpected error',
							)
						})
						isNearBottomRef.current = true
					}}
					onSendAttachment={
						isEditingMessage
							? () => {
								toast.info('Edit mode', 'Finish editing before sending files.')
							}
							: handleAttachmentPick
					}
				/>
			</Animated.View>
			{newIncomingCount > 0 ? (
				<Pressable
					onPress={() => {
						setNewIncomingCount(0)
						isNearBottomRef.current = true
						scrollToBottom(true, true)
					}}
					style={[
						styles.newMessagesFab,
						{
							backgroundColor: theme.colors.accent,
							bottom:
								composerBottomInset +
								composerHeight +
								(typingMembers.length > 0 ? 58 : 16),
						},
					]}
				>
					<Feather name='chevron-down' size={14} color='#FFFFFF' />
					<Text style={styles.newMessagesFabText}>
						{newIncomingCount} new
					</Text>
				</Pressable>
			) : null}
			{typingMembers.length > 0 ? (
				<Animated.View
					pointerEvents='none'
					style={[
						styles.typingDock,
						{
							bottom: composerBottomInset + composerHeight + 6,
							transform: [{ translateY: composerTranslateY }],
						},
					]}
				>
					<TypingIndicator label={typingLabel} />
				</Animated.View>
			) : null}
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		alignItems: 'center',
		borderBottomWidth: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		minHeight: 66,
		paddingHorizontal: 12,
	},
	headerLeft: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
	},
	headerTapTarget: {
		alignItems: 'center',
		borderRadius: 12,
		flex: 1,
		flexDirection: 'row',
		gap: 10,
		minHeight: 46,
		paddingHorizontal: 4,
	},
	headerCopy: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 16,
		fontWeight: '700',
	},
	headerSubtitle: {
		fontSize: 12,
	},
	headerSubtitleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6,
	},
	presenceDot: {
		borderRadius: 999,
		height: 7,
		width: 7,
	},
	headerActions: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
	},
	actionButton: {
		alignItems: 'center',
		height: 32,
		justifyContent: 'center',
		width: 32,
	},
	messagesContainer: {
		flexGrow: 1,
		paddingHorizontal: 12,
		paddingTop: 10,
	},
	newMessagesDivider: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		marginBottom: 6,
		marginTop: 10,
	},
	newMessagesLine: {
		flex: 1,
		height: 1,
	},
	newMessagesText: {
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase',
	},
	composerDock: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
	},
	typingDock: {
		left: 0,
		paddingHorizontal: 12,
		position: 'absolute',
		right: 0,
	},
	newMessagesFab: {
		alignItems: 'center',
		borderRadius: 18,
		flexDirection: 'row',
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 7,
		position: 'absolute',
		right: 14,
		zIndex: 20,
	},
	newMessagesFabText: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: '700',
	},
	emptyStateWrap: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 4,
	},
	emptyWrap: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 16,
	},
	backBtn: {
		alignItems: 'center',
		height: 34,
		justifyContent: 'center',
		width: 24,
	},
})
