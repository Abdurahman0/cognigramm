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

import { ChatComposer, MessageBubble } from '@/components/chat'
import { Avatar } from '@/components/common/Avatar'
import { EmptyState } from '@/components/common/EmptyState'
import { useAppToast } from '@/hooks/useAppToast'
import { useAppTheme } from '@/hooks/useAppTheme'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useChatStore } from '@/store/chatStore'
import type { ChatMessage, ChatSummary } from '@/types'
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
	const isNearBottomRef = useRef(true)
	const lastMessageIdRef = useRef('')
	const shouldRunInitialScrollRef = useRef(true)

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
	const selectedMessage = useMemo(
		() => messages.find(message => message.id === selectedMessageId),
		[messages, selectedMessageId],
	)

	useFocusEffect(
		useCallback(() => {
			setEntryScrollReady(false)
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
			}
		}, [
			chatId,
			markConversationRead,
			sendTypingEvent,
			setActiveConversationId,
		]),
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

		const shouldStickToBottom =
			isNearBottomRef.current || nextLastMessage.senderId === currentUser.id
		if (!shouldStickToBottom) {
			return
		}

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

			const keyboardTop =
				event.endCoordinates?.screenY ??
				Dimensions.get('window').height - (event.endCoordinates?.height ?? 0)

			measureComposerBottom(currentBottom => {
				const keyboardGap =
					Platform.OS === 'android' ? baselineBottomInsetRef.current : 0
				const baselineBottom =
					baselineComposerBottomRef.current ?? currentBottom
				const referenceBottom = Math.max(currentBottom, baselineBottom)
				const overlap = referenceBottom + keyboardGap - keyboardTop
				const duration =
					typeof event.duration === 'number' && event.duration > 0
						? event.duration
						: 220
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

	const openMessageActions = (message: ChatMessage) => {
		setSelectedMessageId(message.id)
		const runAction = (action: 'edit' | 'delete') => {
			if (action === 'edit') {
				if (message.senderId !== currentUser.id || message.isDeleted) {
					toast.info(
						'Edit restricted',
						'Only your non-deleted messages can be edited.',
					)
					return
				}
				const updated = `${message.body} (edited)`
				editMessage(chat.id, message.id, updated)
				toast.success('Message updated')
			}
			if (action === 'delete') {
				if (
					message.senderId !== currentUser.id &&
					currentUser.role !== 'manager' &&
					currentUser.role !== 'ceo'
				) {
					toast.error(
						'Delete restricted',
						'Only owners or managers can delete this message.',
					)
					return
				}
				deleteMessage(chat.id, message.id)
				toast.success('Message deleted')
			}
		}

		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					options: ['Edit', 'Delete', 'Cancel'],
					destructiveButtonIndex: 1,
					cancelButtonIndex: 2,
				},
				index => {
					if (index === 0) runAction('edit')
					if (index === 1) runAction('delete')
				},
			)
			return
		}

		Alert.alert('Message Actions', 'Choose an action', [
			{ text: 'Edit', onPress: () => runAction('edit') },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: () => runAction('delete'),
			},
			{ text: 'Cancel', style: 'cancel' },
		])
	}

	const typingMembers = users.filter(
		user => chat.typingUserIds.includes(user.id) && user.id !== currentUser.id,
	)
	const typingFirstNames = typingMembers.map(
		user => user.fullName.split(' ')[0] ?? user.fullName,
	)
	const joinedTypingNames = typingFirstNames.join(', ')
	const typingSubtitle =
		typingMembers.length === 0
			? null
			: chat.kind === 'direct'
				? `${typingFirstNames[0] ?? 'Someone'} typing...`
				: typingMembers.length > 3 || joinedTypingNames.length > 26
					? `${typingMembers.length} people typing...`
					: `${joinedTypingNames} ${typingMembers.length === 1 ? 'is' : 'are'} typing...`

	const headerSubtitle =
		typingSubtitle ??
		(chat.kind === 'direct'
			? 'Direct message'
			: `${chat.memberIds.length} members`)
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

	const handleAttachmentPick = async () => {
		try {
			const result = await DocumentPicker.getDocumentAsync({
				multiple: false,
				copyToCacheDirectory: false,
			})

			if (result.canceled || result.assets.length === 0) {
				return
			}

			const file = result.assets[0]
			if (!file) {
				return
			}
			await sendMessage({
				chatId: chat.id,
				body: file.name,
				type: 'file',
				attachment: {
					id: `attachment_${Date.now()}`,
					name: file.name,
					sizeLabel: formatFileSize(file.size),
					mimeType: file.mimeType ?? 'application/octet-stream',
					uri: file.uri,
				},
			})
			toast.success('File sent', file.name)
		} catch (error) {
			toast.error(
				'Unable to send file',
				error instanceof Error ? error.message : 'Unexpected upload error.',
			)
		}
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

	return (
		<KeyboardAvoidingView
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			enabled={Platform.OS === 'ios'}
			behavior='padding'
			keyboardVerticalOffset={0}
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
						<Feather
							name='chevron-right'
							size={16}
							color={theme.colors.textMuted}
						/>
					</Pressable>
				</View>
				<View style={styles.headerActions}>
					<Pressable
						onPress={() =>
							router.push({
								pathname: '/(app)/media/[chatId]',
								params: { chatId },
							})
						}
						style={styles.actionButton}
					>
						<Feather
							name='paperclip'
							size={18}
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
				keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
				onScroll={({ nativeEvent }) => {
					if (ignoreNextScrollEventRef.current) {
						return
					}
					const distanceFromBottom =
						nativeEvent.contentSize.height -
						(nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height)
					isNearBottomRef.current = distanceFromBottom < 88
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
							height: composerHeight + 8,
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
								senderName={sender?.fullName ?? 'Unknown'}
								isMine={item.senderId === currentUser.id}
								onLongPress={() => openMessageActions(item)}
							/>
						</View>
					)
				}}
				onContentSizeChange={() => {
					if (selectedMessage) {
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
					onTypingStart={() => sendTypingEvent(chat.id, true)}
					onTypingStop={() => sendTypingEvent(chat.id, false)}
					onSend={body => {
						sendMessage({
							chatId: chat.id,
							body,
							type: 'text',
						}).catch(error => {
							toast.error(
								'Unable to send message',
								error instanceof Error ? error.message : 'Unexpected error',
							)
						})
						isNearBottomRef.current = true
					}}
					onSendAttachment={handleAttachmentPick}
				/>
			</Animated.View>
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
