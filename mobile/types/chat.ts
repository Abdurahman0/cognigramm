import type { ID } from "@/types/common";

export type ChatKind = "direct" | "group";
export type MessageType = "text" | "image" | "file" | "voice" | "video_note" | "system";
export type DeliveryState = "sending" | "sent" | "delivered" | "seen";

export interface VoiceAttachmentMetadata {
  duration_ms?: number;
  waveform?: number[];
  codec?: string;
}

export interface VideoNoteAttachmentMetadata {
  duration_ms?: number;
  width?: number;
  height?: number;
  fps?: number;
  thumbnail_url?: string;
}

export type MediaAttachmentMetadata = VoiceAttachmentMetadata | VideoNoteAttachmentMetadata | Record<string, unknown>;

export interface FileAttachment {
  id: ID;
  name: string;
  sizeLabel: string;
  sizeBytes?: number;
  mimeType: string;
  uri?: string;
  webFile?: Blob;
  bucket?: string;
  objectKey?: string;
  originalName?: string;
  publicUrl?: string | null;
  metadataJson?: MediaAttachmentMetadata | null;
}

export interface ChatMessage {
  id: ID;
  clientMessageId?: string;
  chatId: ID;
  senderId: ID;
  body: string;
  type: MessageType;
  createdAt: string;
  editedAt?: string;
  attachment?: FileAttachment;
  status: DeliveryState;
  seenByIds: ID[];
  deliveredToIds: ID[];
  isDeleted?: boolean;
}

export interface ChatSummary {
  id: ID;
  title: string;
  subtitle?: string;
  kind: ChatKind;
  createdAt?: string;
  memberIds: ID[];
  avatar?: string;
  lastMessageId?: ID;
  unreadCount: number;
  typingUserIds: ID[];
}
