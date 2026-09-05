/**
 * Wire types, mirroring the backend's Pydantic schemas exactly (snake_case).
 *
 * Nothing in the UI layer consumes these directly — `src/api/adapters.ts` maps
 * them into the camelCase domain model, which keeps a backend rename from
 * rippling through every component.
 */

export type ApiConversationType = 'direct' | 'group'
export type ApiParticipantRole = 'admin' | 'member'
export type ApiUserStatus = 'available' | 'in_meeting' | 'busy' | 'on_break' | 'offline' | 'remote'
export type ApiMessageType = 'text' | 'image' | 'file' | 'voice' | 'video_note' | 'system'
export type ApiMessageStatus = 'sent' | 'failed'
export type ApiDeliveryState = 'queued' | 'persisted' | 'delivered' | 'read' | 'failed'
export type ApiCallType = 'audio' | 'video'
export type ApiCallState =
  'ringing' | 'active' | 'ended' | 'missed' | 'rejected' | 'cancelled' | 'failed'

export interface ApiTokenResponse {
  access_token: string
  token_type: string
  /** Present for `client_type: "mobile"`; the web flow returns null and a cookie. */
  refresh_token: string | null
  /** Access-token lifetime in seconds; 900 at the time of writing. */
  expires_in: number
  /** The device session this token belongs to — not the presence session id. */
  session_id: string | null
}

/** One row of `GET /auth/sessions`: a device that can refresh into this account. */
export interface ApiDeviceSession {
  id: string
  device_name: string
  created_at: string
  last_used_at: string | null
  expires_at: string
  is_current: boolean
}

/** `GET /files/access` — a fresh signed GET URL for a stored object. */
export interface ApiFileAccess {
  url: string
  expires_in: number
}

export type ApiChangeEvent =
  'message_created' | 'message_edited' | 'message_deleted' | 'message_pinned' | 'message_unpinned'

/**
 * One entry of the per-conversation change feed. `message` is the message's
 * *current* state, not a snapshot of the moment the change happened, so
 * entries apply as upserts and order does not matter.
 */
export interface ApiChangeItem {
  cursor: number
  event: ApiChangeEvent
  message: ApiMessage
}

export interface ApiChangesPage {
  items: ApiChangeItem[]
  next_cursor: number
  has_more: boolean
}

export interface ApiUser {
  id: number
  username: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role_id: number | null
  department_id: number | null
  title: string | null
  about: string | null
  timezone: string
  phone: string | null
  handle: string | null
  office_location: string | null
  manager_id: number | null
  last_seen_at: string | null
  status: ApiUserStatus
  created_at: string
}

export interface ApiConversationMember {
  user_id: number
  username: string
  role: ApiParticipantRole
  joined_at: string
}

export interface ApiConversation {
  id: number
  type: ApiConversationType
  title: string | null
  created_at: string
  participants: ApiConversationMember[]
}

export interface ApiAttachmentIn {
  bucket: string
  object_key: string
  original_name: string
  mime_type: string
  size_bytes: number
  public_url?: string | null
  metadata_json?: Record<string, unknown> | null
}

export interface ApiAttachmentOut extends ApiAttachmentIn {
  id: number
  public_url: string | null
  created_at: string
}

export interface ApiMessage {
  id: number
  conversation_id: number
  sender_id: number | null
  sender: { id: number; username: string } | null
  client_message_id: string
  content: string | null
  message_type: ApiMessageType
  reply_to_message_id?: number | null
  forwarded_from_message_id?: number | null
  is_pinned?: boolean
  pinned_by_user_id?: number | null
  pinned_at?: string | null
  status: ApiMessageStatus
  delivery_state: ApiDeliveryState
  attachments: ApiAttachmentOut[]
  queued_at: string | null
  persisted_at: string | null
  delivered_at: string | null
  read_at: string | null
  delivery_updated_at: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

export interface ApiMessageSearchHit {
  message: ApiMessage
  rank: number
}

export interface ApiDeliveryReceipt {
  id: number
  message_id: number
  conversation_id: number
  user_id: number
  read_at: string | null
}

export interface ApiTypingState {
  conversation_id: number
  user_ids: number[]
}

export interface ApiPresenceState {
  user_id: number
  is_online: boolean
  active_conversation_id: number | null
  sessions: number
  last_seen: string | null
  updated_at: string | null
}

export interface ApiLocalUploadResponse {
  bucket: string
  object_key: string
  original_name: string
  mime_type: string
  size_bytes: number
  public_url: string | null
}

export interface ApiPresignedUploadRequest {
  filename: string
  content_type: string
  size_bytes: number
}

export interface ApiPresignedUploadResponse {
  upload_url: string
  bucket: string
  object_key: string
  expires_in: number
  content_type: string
  size_bytes: number
  public_url: string | null
}

export interface ApiCallParticipant {
  user_id: number
  state: string
  is_online_when_invited: boolean
  joined_at: string | null
  left_at: string | null
  created_at: string
}

export interface ApiCallSession {
  id: string
  conversation_id: number
  initiator_id: number
  call_type: ApiCallType
  state: ApiCallState
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
  participants: ApiCallParticipant[]
}

export interface ApiCallsHistoryResponse {
  total: number
  calls: ApiCallSession[]
}

export interface ApiSocketEnvelope<TPayload = Record<string, unknown>> {
  event: string
  payload: TPayload
}
