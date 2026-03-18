export type ApiConversationType = "direct" | "group";
export type ApiParticipantRole = "admin" | "member";
export type ApiUserStatus = "available" | "in_meeting" | "busy" | "on_break" | "offline" | "remote";
export type ApiMessageType = "text" | "image" | "file" | "voice" | "video_note" | "system";
export type ApiMessageStatus = "sent" | "failed";
export type ApiDeliveryState = "queued" | "persisted" | "delivered" | "read" | "failed";
export type ApiCallType = "audio" | "video";
export type ApiCallState = "ringing" | "active" | "ended" | "missed" | "rejected" | "cancelled" | "failed";

export interface ApiTokenResponse {
  access_token: string;
  token_type: "bearer" | string;
}

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role_id: number | null;
  department_id: number | null;
  title: string | null;
  about: string | null;
  timezone: string;
  phone: string | null;
  handle: string | null;
  office_location: string | null;
  manager_id: number | null;
  last_seen_at: string | null;
  status: ApiUserStatus;
  created_at: string;
}

export interface ApiConversationMember {
  user_id: number;
  username: string;
  role: ApiParticipantRole;
  joined_at: string;
}

export interface ApiConversation {
  id: number;
  type: ApiConversationType;
  title: string | null;
  created_at: string;
  participants: ApiConversationMember[];
}

export interface ApiMessageAttachmentIn {
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  public_url?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface ApiMessageAttachmentOut {
  id: number;
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface ApiMessage {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender: {
    id: number;
    username: string;
  } | null;
  client_message_id: string;
  content: string | null;
  message_type: ApiMessageType;
  status: ApiMessageStatus;
  delivery_state: ApiDeliveryState;
  attachments: ApiMessageAttachmentOut[];
  queued_at: string | null;
  persisted_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  delivery_updated_at: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}


export interface ApiPresignedUploadRequest {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface ApiPresignedUploadResponse {
  upload_url: string;
  bucket: string;
  object_key: string;
  expires_in: number;
  content_type: string;
  size_bytes: number;
  public_url: string | null;
}

export interface ApiLocalUploadResponse {
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string | null;
}

export interface ApiPresenceState {
  user_id: number;
  is_online: boolean;
  active_conversation_id: number | null;
  sessions: number;
  last_seen: string | null;
  updated_at: string | null;
}

export interface ApiCallParticipant {
  user_id: number;
  state: string;
  is_online_when_invited: boolean;
  joined_at: string | null;
  left_at: string | null;
  created_at: string;
}

export interface ApiCallSession {
  id: string;
  conversation_id: number;
  initiator_id: number;
  call_type: ApiCallType;
  state: ApiCallState;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  participants: ApiCallParticipant[];
}

export interface ApiCallsHistoryResponse {
  total: number;
  calls: ApiCallSession[];
}

export interface ApiSocketEnvelope<TPayload = Record<string, unknown>> {
  event: string;
  payload: TPayload;
}
