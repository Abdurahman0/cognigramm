import type { ApiCallState, ApiCallType, ApiMessageType, ApiUserStatus } from '@/api/types'

/** Domain model. camelCase, no nulls where the UI would only have to re-check. */

export type UserPresence = ApiUserStatus
export type MessageKind = ApiMessageType
export type ConversationKind = 'direct' | 'group'
export type DeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface User {
  id: number
  username: string
  email: string
  fullName: string
  avatarUrl: string | null
  title: string
  about: string
  timezone: string
  phone: string | null
  handle: string | null
  officeLocation: string | null
  presence: UserPresence
  lastSeenAt: string | null
  createdAt: string
}

export interface Attachment {
  id: number
  name: string
  mimeType: string
  sizeBytes: number
  sizeLabel: string
  url: string | null
  bucket: string
  objectKey: string
  metadata: Record<string, unknown> | null
}

export interface Message {
  id: number
  clientMessageId: string
  conversationId: number
  senderId: number | null
  senderName: string | null
  body: string
  kind: MessageKind
  delivery: DeliveryState
  attachments: Attachment[]
  replyToMessageId: number | null
  isPinned: boolean
  isDeleted: boolean
  createdAt: string
  editedAt: string | null
  /** Set only on optimistic rows that have not come back from the server yet. */
  pending?: boolean
  /** Populated when the send failed, so the bubble can offer a retry. */
  error?: string
}

export interface ConversationMember {
  userId: number
  username: string
  role: 'admin' | 'member'
  joinedAt: string
}

export interface Conversation {
  id: number
  kind: ConversationKind
  title: string
  members: ConversationMember[]
  createdAt: string
  /** Direct chats resolve to the other participant; groups leave this null. */
  peerId: number | null
}

export type CallDirection = 'incoming' | 'outgoing'

export interface CallRecord {
  id: string
  conversationId: number
  initiatorId: number
  callType: ApiCallType
  state: ApiCallState
  direction: CallDirection
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  participantIds: number[]
}
