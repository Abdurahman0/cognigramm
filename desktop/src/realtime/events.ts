import type { ApiCallSession, ApiConversation, ApiDeliveryState, ApiMessage } from '@/api/types'

/** Client -> server. Names match the backend's dispatcher exactly. */
export type OutgoingEvent =
  | 'send_message'
  | 'delivery_ack'
  | 'read_receipt'
  | 'typing_start'
  | 'typing_stop'
  | 'edit_message'
  | 'delete_message'
  | 'pin_message'
  | 'unpin_message'
  | 'join_conversation'
  | 'leave_conversation'
  | 'active_conversation'
  | 'sync_missed'
  | 'call_invite'
  | 'call_accept'
  | 'call_reject'
  | 'call_end'
  | 'call_signal'

export interface ConnectedPayload {
  user_id: number
  session_id: string
  rooms: number[]
  online_users: number[]
  rate_limit_per_second: number
}

/**
 * Delivery updates.
 *
 * Observed on the wire as `{message_id, state, updated_at}` — no
 * conversation_id, and the field is `state`, not `delivery_state`. The
 * documented spelling is accepted too, since `message_delivered` and
 * `message_read` are emitted by a different code path.
 */
export interface DeliveryStatePayload {
  message_id: number
  conversation_id?: number
  state?: ApiDeliveryState
  delivery_state?: ApiDeliveryState
  updated_at?: string
  user_id?: number
}

/** `message_queued`: the broker accepted it; nothing is persisted yet. */
export interface QueuedPayload {
  client_message_id: string
  conversation_id: number
}

/** `message_persisted_ack`: binds a client id to the id the database assigned. */
export interface PersistedAckPayload {
  client_message_id: string
  conversation_id: number
  message_id: number
}

export interface TypingPayload {
  conversation_id: number
  user_id: number
}

export interface PresencePayload {
  user_id: number
  last_seen?: string | null
}

export interface CallSignalPayload {
  call_id: string
  from_user_id?: number
  target_user_id?: number
  signal_type: 'offer' | 'answer' | 'ice' | string
  sdp?: string | null
  candidate?: RTCIceCandidateInit | null
}

export interface IncomingCallPayload {
  call: ApiCallSession
  from_user_id: number
}

export interface CallInviteAckPayload {
  call: ApiCallSession
  online_user_ids: number[]
  offline_user_ids: number[]
}

/** Shared by call_accepted, call_rejected, call_ended and call_participant_left. */
export interface CallLifecyclePayload {
  call: ApiCallSession
  user_id: number
  end_for_all?: boolean
}

export interface ErrorPayload {
  detail: string | { msg?: string }[]
  reset_at_epoch?: number
}

/**
 * Server -> client payload shapes, keyed by event name. Anything not listed
 * still arrives — handlers just receive `unknown` for it.
 */
export interface ServerEventMap {
  connected: ConnectedPayload
  message_queued: QueuedPayload
  message_persisted: ApiMessage
  message_persisted_ack: PersistedAckPayload
  message_retrying: { client_message_id: string; attempt: number }
  message_failed: { client_message_id: string; detail?: string }
  message_delivered: DeliveryStatePayload
  message_read: DeliveryStatePayload
  message_delivery_state: DeliveryStatePayload
  message_edited: ApiMessage
  message_deleted: ApiMessage
  message_pinned: ApiMessage
  message_unpinned: ApiMessage
  missed_messages: { conversation_id: number; messages: ApiMessage[] }
  /** Sent to every member the moment a conversation is created. */
  conversation_created: ApiConversation
  conversation_members_added: ApiConversation
  conversation_member_removed: { conversation: ApiConversation; removed_user_id: number }
  conversation_removed: { conversation_id: number }
  typing_start: TypingPayload
  typing_stop: TypingPayload
  user_online: PresencePayload
  user_offline: PresencePayload
  last_seen_update: PresencePayload
  incoming_call: IncomingCallPayload
  call_invite_ack: CallInviteAckPayload
  call_signal: CallSignalPayload
  call_accepted: CallLifecyclePayload
  call_rejected: CallLifecyclePayload
  call_ended: CallLifecyclePayload
  call_participant_left: CallLifecyclePayload
  error: ErrorPayload
  rate_limited: ErrorPayload
}

export type ServerEvent = keyof ServerEventMap
