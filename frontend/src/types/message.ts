import type { UserBrief } from "@/types/user";

export type MessageType = "text" | "image" | "file" | "voice" | "system";
export type MessageStatus = "sent" | "failed";
export type DeliveryState = "queued" | "persisted" | "delivered" | "read" | "failed";

export interface MessageAttachment {
  id: number;
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender: UserBrief | null;
  client_message_id: string;
  content: string | null;
  message_type: MessageType;
  status: MessageStatus;
  delivery_state: DeliveryState;
  attachments: MessageAttachment[];
  queued_at: string | null;
  persisted_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  delivery_updated_at: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  local_state?: "pending" | "synced" | "failed";
}

export interface MessageSearchResult {
  message: Message;
  rank: number;
}

export interface MessageAttachmentInput {
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  public_url?: string | null;
}

export interface SendMessagePayload {
  conversation_id: number;
  content?: string | null;
  type: MessageType;
  client_message_id: string;
  attachments?: MessageAttachmentInput[];
}

export interface DeliveryReceipt {
  id: number;
  message_id: number;
  user_id: number;
  state: DeliveryState;
  queued_at: string | null;
  persisted_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  updated_at: string;
}

export interface PresignedUploadRequest {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface PresignedUploadResponse {
  upload_url: string;
  bucket: string;
  object_key: string;
  expires_in: number;
  content_type: string;
  size_bytes: number;
  public_url?: string | null;
}
