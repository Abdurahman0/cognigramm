import { Feather } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

import { AppText, GlassView, ListRow } from '@/components/ui'
import { useAppTheme } from '@/hooks/useAppTheme'
import type { ChatMessage, ChatSummary } from '@/types'

interface ForwardSheetProps {
	message: ChatMessage | null
	chats: ChatSummary[]
	/** The conversation the message is already in; never a destination. */
	sourceChatId: string
	onCancel: () => void
	onSelect: (chatId: string) => void
}

const previewOf = (message: ChatMessage | null): string => {
	if (!message) return ''
	if (message.body.trim()) return message.body.replace(/\s+/g, ' ').trim()
	switch (message.type) {
		case 'image':
			return 'Photo'
		case 'voice':
			return 'Voice message'
		case 'video_note':
			return 'Video message'
		case 'file':
			return message.attachment?.name ?? 'File'
		default:
			return 'Message'
	}
}

/** Picks a destination conversation for a message being forwarded. */
export function ForwardSheet({
	message,
	chats,
	sourceChatId,
	onCancel,
	onSelect,
}: ForwardSheetProps): JSX.Element {
	const { theme } = useAppTheme()
	const [term, setTerm] = useState('')

	const options = useMemo(() => {
		const needle = term.trim().toLowerCase()
		return chats
			.filter(chat => chat.id !== sourceChatId)
			.filter(chat => (needle ? chat.title.toLowerCase().includes(needle) : true))
	}, [chats, sourceChatId, term])

	return (
		<Modal
			visible={Boolean(message)}
			transparent
			animationType="fade"
			onRequestClose={onCancel}
		>
			{/* The scrim is a sibling of the card, not its parent: React Native Web
			    gives a press to the outermost Pressable, so a card nested inside a
			    dismiss-on-press scrim would swallow every row tap. */}
			<View style={styles.scrim}>
				<Pressable
					style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
					onPress={onCancel}
					accessibilityLabel="Dismiss"
				/>
				<View style={styles.cardWrap}>
					<GlassView
						material="thick"
						radius={theme.radius.sheet}
						highlight
						elevation="floating"
						style={styles.card}
					>
						<View style={styles.header}>
							<AppText variant="headline">Forward to…</AppText>
							<AppText variant="footnote" tone="secondary" numberOfLines={1}>
								{previewOf(message)}
							</AppText>
						</View>

						<View style={[styles.search, { backgroundColor: theme.colors.fillTertiary }]}>
							<Feather name="search" size={15} color={theme.colors.textMuted} />
							<TextInput
								value={term}
								onChangeText={setTerm}
								placeholder="Search conversations"
								placeholderTextColor={theme.colors.textMuted}
								style={[styles.searchInput, { color: theme.colors.textPrimary }]}
							/>
						</View>

						<ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
							{options.length === 0 ? (
								<AppText variant="footnote" tone="secondary" style={styles.empty}>
									No other conversations.
								</AppText>
							) : (
								options.map(chat => (
									<ListRow
										key={chat.id}
										title={chat.title}
										subtitle={chat.subtitle}
										icon={chat.kind === 'group' ? 'users' : 'user'}
										onPress={() => onSelect(chat.id)}
									/>
								))
							)}
						</ScrollView>

						<Pressable onPress={onCancel} style={styles.cancel}>
							<AppText variant="subheadEmphasized" tone="accent">
								Cancel
							</AppText>
						</Pressable>
					</GlassView>
				</View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	scrim: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center',
		padding: 20,
	},
	cardWrap: {
		maxWidth: 460,
		width: '100%',
	},
	card: {
		gap: 12,
		maxHeight: 520,
		padding: 16,
	},
	header: {
		gap: 2,
	},
	search: {
		alignItems: 'center',
		borderRadius: 12,
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	searchInput: {
		flex: 1,
		fontSize: 15,
		padding: 0,
	},
	list: {
		maxHeight: 320,
	},
	empty: {
		paddingVertical: 24,
		textAlign: 'center',
	},
	cancel: {
		alignItems: 'center',
		paddingVertical: 8,
	},
})
