import type {
  ApiAttachmentOut,
  ApiCallSession,
  ApiConversation,
  ApiDeliveryState,
  ApiMessage,
  ApiUser,
} from '@/api/types'
import type { Attachment, CallRecord, Conversation, DeliveryState, Message, User } from '@/types'

export const formatBytes = (value: number | null | undefined): string => {
  if (!value || Number.isNaN(value)) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * The backend's five delivery states collapse to what a tick mark can show.
 * `queued` is the server's word for "accepted but not yet written", which from
 * the sender's side still reads as in-flight.
 */
const DELIVERY: Record<ApiDeliveryState, DeliveryState> = {
  queued: 'sending',
  persisted: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
}

export const toUser = (api: ApiUser): User => ({
  id: api.id,
  username: api.username,
  email: api.email,
  fullName: api.full_name?.trim() || api.username,
  avatarUrl: api.avatar_url,
  title: api.title?.trim() || '',
  about: api.about ?? '',
  timezone: api.timezone || 'UTC',
  phone: api.phone,
  handle: api.handle,
  officeLocation: api.office_location,
  presence: api.status,
  lastSeenAt: api.last_seen_at,
  createdAt: api.created_at,
})

export const toAttachment = (api: ApiAttachmentOut): Attachment => ({
  id: api.id,
  name: api.original_name,
  mimeType: api.mime_type,
  sizeBytes: api.size_bytes,
  sizeLabel: formatBytes(api.size_bytes),
  signedUrl: api.public_url,
  bucket: api.bucket,
  objectKey: api.object_key,
  metadata: api.metadata_json ?? null,
})

export const toMessage = (api: ApiMessage): Message => ({
  id: api.id,
  clientMessageId: api.client_message_id,
  conversationId: api.conversation_id,
  senderId: api.sender_id,
  senderName: api.sender?.username ?? null,
  body: api.deleted_at ? '' : (api.content ?? ''),
  kind: api.message_type,
  delivery: api.status === 'failed' ? 'failed' : DELIVERY[api.delivery_state],
  attachments: (api.attachments ?? []).map(toAttachment),
  replyToMessageId: api.reply_to_message_id ?? null,
  forwardedFromMessageId: api.forwarded_from_message_id ?? null,
  isPinned: Boolean(api.is_pinned),
  isDeleted: Boolean(api.deleted_at),
  createdAt: api.created_at,
  editedAt: api.edited_at,
})

export const toConversation = (api: ApiConversation, currentUserId: number): Conversation => {
  const kind = api.type === 'direct' ? 'direct' : 'group'
  const peer = api.participants.find((member) => member.user_id !== currentUserId)
  const title =
    kind === 'direct'
      ? (peer?.username ?? api.title ?? 'Direct message')
      : api.title?.trim() || `Group ${api.id}`

  return {
    id: api.id,
    kind,
    title,
    members: api.participants.map((member) => ({
      userId: member.user_id,
      username: member.username,
      role: member.role,
      joinedAt: member.joined_at,
    })),
    createdAt: api.created_at,
    peerId: kind === 'direct' ? (peer?.user_id ?? null) : null,
  }
}

export const toCallRecord = (api: ApiCallSession, currentUserId: number): CallRecord => ({
  id: api.id,
  conversationId: api.conversation_id,
  initiatorId: api.initiator_id,
  callType: api.call_type,
  state: api.state,
  direction: api.initiator_id === currentUserId ? 'outgoing' : 'incoming',
  startedAt: api.started_at,
  endedAt: api.ended_at,
  createdAt: api.created_at,
  participantIds: api.participants.map((participant) => participant.user_id),
})
