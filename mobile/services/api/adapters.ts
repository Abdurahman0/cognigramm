import type {
  ApiCallSession,
  ApiConversation,
  ApiDeliveryState,
  ApiMessage,
  ApiMessageAttachmentIn,
  ApiMessageAttachmentOut,
  ApiMessageType,
  ApiUser
} from "@/services/api";
import type {
  CallSession,
  CallDirection,
  ChatKind,
  ChatMessage,
  ChatSummary,
  Department,
  DeliveryState,
  EmployeeRole,
  FileAttachment,
  MessageType,
  SharedFileItem,
  User,
  UserPresence
} from "@/types";
import { mapBackendStateToStatus } from "@/features/calls/utils/statusMapper";

const ROLE_BY_ID: Record<number, EmployeeRole> = {
  1: "ceo",
  2: "cto",
  3: "manager",
  4: "hr",
  5: "developer",
  6: "designer",
  7: "product",
  8: "qa",
  9: "intern"
};

const DEPARTMENT_BY_ID: Record<number, Department> = {
  1: "Executive",
  2: "Engineering",
  3: "Product",
  4: "Design",
  5: "HR",
  6: "Operations",
  7: "Sales"
};

const formatBytes = (value?: number | null): string => {
  if (!value || Number.isNaN(value)) {
    return "Unknown size";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const mapRole = (roleId: number | null): EmployeeRole => (roleId != null ? ROLE_BY_ID[roleId] ?? "employee" : "employee");
const mapDepartment = (departmentId: number | null): Department =>
  departmentId != null ? DEPARTMENT_BY_ID[departmentId] ?? "General" : "General";

const mapPresence = (status: ApiUser["status"]): UserPresence => status;

const mapMessageType = (messageType: ApiMessageType): MessageType => messageType;
const mapDeliveryState = (state: ApiDeliveryState): DeliveryState => {
  if (state === "queued") {
    return "sending";
  }
  if (state === "persisted") {
    return "sent";
  }
  if (state === "delivered") {
    return "delivered";
  }
  if (state === "read") {
    return "seen";
  }
  return "sent";
};

const toAttachment = (attachment: ApiMessageAttachmentOut | undefined): FileAttachment | undefined => {
  if (!attachment) {
    return undefined;
  }
  const publicUrl = attachment.public_url ?? null;
  return {
    id: String(attachment.id),
    name: attachment.original_name,
    sizeLabel: formatBytes(attachment.size_bytes),
    sizeBytes: attachment.size_bytes,
    mimeType: attachment.mime_type,
    uri: publicUrl ?? undefined,
    bucket: attachment.bucket,
    objectKey: attachment.object_key,
    originalName: attachment.original_name,
    publicUrl,
    metadataJson: attachment.metadata_json ?? null
  };
};

export const toChatId = (value: number | string): string => String(value);

export const mapApiUserToUser = (
  apiUser: ApiUser,
  options: {
    onlineUserIds?: Set<number>;
  } = {}
): User => {
  const isOnlineByPresence = apiUser.status !== "offline";
  const isOnlineByList = options.onlineUserIds ? options.onlineUserIds.has(apiUser.id) : undefined;
  const isOnline = isOnlineByList ?? isOnlineByPresence;
  return {
    id: String(apiUser.id),
    username: apiUser.username,
    fullName: apiUser.full_name?.trim() || apiUser.username,
    email: apiUser.email,
    avatar: apiUser.avatar_url ?? "",
    role: mapRole(apiUser.role_id),
    department: mapDepartment(apiUser.department_id),
    title: apiUser.title?.trim() || "Team Member",
    presence: mapPresence(apiUser.status),
    isOnline,
    about: apiUser.about ?? "",
    timezone: apiUser.timezone || "UTC",
    phone: apiUser.phone ?? undefined,
    handle: apiUser.handle ?? undefined,
    officeLocation: apiUser.office_location ?? undefined,
    managerId: apiUser.manager_id != null ? String(apiUser.manager_id) : undefined,
    createdAt: apiUser.created_at,
    lastSeenAt: apiUser.last_seen_at ?? undefined
  };
};

export const mapApiConversationToChat = (
  conversation: ApiConversation,
  usersById: Record<string, User>,
  currentUserId: string,
  preferences?: {
    unreadCount?: number;
    typingUserIds?: string[];
    lastMessageId?: string;
  }
): ChatSummary => {
  const memberIds = conversation.participants.map((participant) => String(participant.user_id));
  const conversationKind: ChatKind = conversation.type === "direct" ? "direct" : "group";
  const peer = conversation.type === "direct"
    ? conversation.participants.find((participant) => String(participant.user_id) !== currentUserId)
    : undefined;
  const peerUser = peer ? usersById[String(peer.user_id)] : undefined;
  const title =
    conversationKind === "direct"
      ? peerUser?.fullName ?? peer?.username ?? conversation.title ?? "Direct message"
      : conversation.title?.trim() || `Group ${conversation.id}`;

  return {
    id: String(conversation.id),
    title,
    subtitle: conversationKind === "direct" ? peerUser?.title : `${memberIds.length} members`,
    kind: conversationKind,
    memberIds,
    avatar: conversationKind === "direct" ? peerUser?.avatar : undefined,
    unreadCount: preferences?.unreadCount ?? 0,
    typingUserIds: preferences?.typingUserIds ?? [],
    lastMessageId: preferences?.lastMessageId,
    createdAt: conversation.created_at
  };
};

export const mapApiMessageToChatMessage = (message: ApiMessage): ChatMessage => {
  const firstAttachment = message.attachments[0];
  const bodyFromAttachment = firstAttachment ? firstAttachment.original_name : "";
  return {
    id: String(message.id),
    clientMessageId: message.client_message_id,
    chatId: String(message.conversation_id),
    senderId: message.sender_id != null ? String(message.sender_id) : "system",
    body: message.deleted_at ? "" : message.content ?? bodyFromAttachment,
    type: mapMessageType(message.message_type),
    createdAt: message.created_at,
    editedAt: message.edited_at ?? undefined,
    attachment: toAttachment(firstAttachment),
    status: mapDeliveryState(message.delivery_state),
    seenByIds: [],
    deliveredToIds: [],
    isDeleted: Boolean(message.deleted_at)
  };
};

export const mapUploadAttachmentToApi = (
  upload: {
    bucket: string;
    object_key: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    public_url?: string | null;
    metadata_json?: Record<string, unknown> | null;
  }
): ApiMessageAttachmentIn => ({
  bucket: upload.bucket,
  object_key: upload.object_key,
  original_name: upload.original_name,
  mime_type: upload.mime_type,
  size_bytes: upload.size_bytes,
  public_url: upload.public_url ?? null,
  metadata_json: upload.metadata_json ?? null
});

export const mapApiCallToCallSession = (
  call: ApiCallSession,
  currentUserId?: string
): CallSession => {
  const initiatorId = String(call.initiator_id);
  const direction: CallDirection =
    currentUserId && currentUserId === initiatorId ? "outgoing" : "incoming";
  return {
    id: call.id,
    conversationId: String(call.conversation_id),
    initiatorId,
    callType: call.call_type,
    state: call.state,
    status: mapBackendStateToStatus(call.state, direction),
    direction,
    startedAt: call.started_at ?? undefined,
    endedAt: call.ended_at ?? undefined,
    createdAt: call.created_at,
    updatedAt: call.updated_at,
    participants: call.participants.map((participant) => ({
      userId: String(participant.user_id),
      state: participant.state,
      isOnlineWhenInvited: participant.is_online_when_invited,
      joinedAt: participant.joined_at ?? undefined,
      leftAt: participant.left_at ?? undefined,
      createdAt: participant.created_at
    }))
  };
};

export const sortChatsByLastActivity = (
  chats: ChatSummary[],
  messagesByChat: Record<string, ChatMessage[]>
): ChatSummary[] => {
  return [...chats].sort((a, b) => {
    const messagesA = messagesByChat[a.id] ?? [];
    const messagesB = messagesByChat[b.id] ?? [];
    const lastA = messagesA[messagesA.length - 1]?.createdAt ?? a.createdAt ?? "";
    const lastB = messagesB[messagesB.length - 1]?.createdAt ?? b.createdAt ?? "";
    const byDate = lastB.localeCompare(lastA);
    if (byDate !== 0) {
      return byDate;
    }
    return a.title.localeCompare(b.title);
  });
};

export const deriveSharedFiles = (messagesByChat: Record<string, ChatMessage[]>): SharedFileItem[] => {
  const rows: SharedFileItem[] = [];
  Object.entries(messagesByChat).forEach(([chatId, messages]) => {
    messages.forEach((message) => {
      if (message.isDeleted || !message.attachment) {
        return;
      }
      const mime = message.attachment.mimeType.toLowerCase();
      const fileType =
        message.type === "voice"
          ? "voice"
          : message.type === "video_note"
          ? "video_note"
          : message.type === "image" || mime.startsWith("image/")
          ? "image"
          : mime.includes("spreadsheet")
          ? "spreadsheet"
          : mime.includes("presentation")
          ? "presentation"
          : mime.includes("zip") || mime.includes("tar")
          ? "archive"
          : "document";
      rows.push({
        id: `${message.id}_${message.attachment.id}`,
        chatId,
        ownerId: message.senderId,
        title: message.attachment.name,
        type: fileType,
        sizeLabel: message.attachment.sizeLabel,
        uploadedAt: message.createdAt
      });
    });
  });
  return rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
};
