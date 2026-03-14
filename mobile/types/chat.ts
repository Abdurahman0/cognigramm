import type { ID } from "@/types/common";

export type ChatKind = "direct" | "group";
export type MessageType = "text" | "image" | "file" | "voice" | "system";
export type DeliveryState = "sending" | "sent" | "delivered" | "seen";

export interface FileAttachment {
  id: ID;
  name: string;
  sizeLabel: string;
  mimeType: string;
  uri?: string;
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
