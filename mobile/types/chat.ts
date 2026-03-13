import type { ID } from "@/types/common";

export type ChatKind = "direct" | "channel" | "announcement" | "group";
export type MessagePriority = "normal" | "important" | "urgent";
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
  priority: MessagePriority;
  createdAt: string;
  editedAt?: string;
  replyToMessageId?: ID;
  forwardedFromMessageId?: ID;
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
  ownerId?: ID;
  memberIds: ID[];
  avatar?: string;
  lastMessageId?: ID;
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  typingUserIds: ID[];
  hasMentions?: boolean;
  departmentLabel?: string;
  isAnnouncementLocked?: boolean;
}

export interface ChannelTemplate {
  id: ID;
  name: string;
  kind: "channel" | "announcement";
  description: string;
  departmentLabel: string;
}
