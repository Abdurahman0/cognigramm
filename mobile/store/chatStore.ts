import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useAuthStore } from "@/store/authStore";
import { conversationsApi, messagesApi, presenceApi, usersApi, type ApiMessage, type ApiSocketEnvelope, type ApiUser } from "@/services/api";
import { deriveSharedFiles, mapApiConversationToChat, mapApiMessageToChatMessage, mapApiUserToUser, mapUploadAttachmentToApi, sortChatsByLastActivity } from "@/services/api/adapters";
import { USE_LOCAL_MEDIA_UPLOAD } from "@/services/api/config";
import { realtimeSocketClient, type SocketStatus } from "@/services/realtime/socketClient";
import type { CallLogItem, ChatKind, ChatMessage, ChatSummary, FileAttachment, MessagePriority, MessageType, SharedFileItem, User, UserPresence } from "@/types";
import { createId } from "@/utils/ids";

export type ChatFilterKey = "all" | "unread" | "channels" | "groups" | "archived" | "pinned";

interface SendMessageInput {
  chatId: string;
  body: string;
  type: MessageType;
  priority: MessagePriority;
  replyToMessageId?: string;
  attachment?: FileAttachment;
}

interface CreateGroupConversationInput {
  title: string;
  memberIds: string[];
  kind: "group" | "channel" | "announcement";
}

interface UpdateCurrentUserProfileInput {
  fullName?: string;
  title?: string;
  about?: string;
  avatar?: string;
  presence?: UserPresence;
  isOnline?: boolean;
}

interface PersistedFields {
  pinnedByChatId: Record<string, boolean>;
  archivedByChatId: Record<string, boolean>;
  mutedByChatId: Record<string, boolean>;
  chatKindByConversationId: Record<string, ChatKind>;
  unreadByChatId: Record<string, number>;
  lastReadMessageIdByChatId: Record<string, string>;
  activeFilter: ChatFilterKey;
  chatSearchQuery: string;
  messageSearchQuery: string;
  activeDesktopChatId: string;
}

interface ChatStore extends PersistedFields {
  hydrated: boolean;
  initializing: boolean;
  users: User[];
  chats: ChatSummary[];
  calls: CallLogItem[];
  sharedFiles: SharedFileItem[];
  messagesByChat: Record<string, ChatMessage[]>;
  loadingOlderByChat: Record<string, boolean>;
  loadedMessageLimitByChat: Record<string, number>;
  activeConversationId: string;
  websocketStatus: SocketStatus;
  appVisible: boolean;
  currentToken: string;
  currentUserId: string;
  markHydrated: () => void;
  initializeForSession: () => Promise<void>;
  refreshChats: () => Promise<void>;
  setActiveFilter: (filter: ChatFilterKey) => void;
  setChatSearchQuery: (query: string) => void;
  setMessageSearchQuery: (query: string) => void;
  setActiveDesktopChatId: (chatId: string) => void;
  setActiveConversationId: (chatId: string) => void;
  setAppVisibility: (visible: boolean) => void;
  handleSocketEvent: (envelope: ApiSocketEnvelope) => void;
  sendTypingEvent: (chatId: string, isTyping: boolean) => void;
  sendMessage: (payload: SendMessageInput) => Promise<void>;
  editMessage: (chatId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  forwardMessage: (sourceChatId: string, messageId: string, targetChatId: string) => Promise<void>;
  loadOlderMessages: (chatId: string) => Promise<void>;
  markConversationRead: (chatId: string) => Promise<void>;
  togglePin: (chatId: string) => void;
  toggleMute: (chatId: string) => void;
  toggleArchive: (chatId: string) => void;
  startDirectConversation: (userId: string) => Promise<string>;
  createGroupConversation: (payload: CreateGroupConversationInput) => Promise<string>;
  updateCurrentUserProfile: (payload: UpdateCurrentUserProfileInput) => Promise<void>;
}

const INITIAL_MESSAGE_LIMIT = 50;
const MESSAGE_PAGE_SIZE = 50;

const initialPersisted: PersistedFields = {
  pinnedByChatId: {},
  archivedByChatId: {},
  mutedByChatId: {},
  chatKindByConversationId: {},
  unreadByChatId: {},
  lastReadMessageIdByChatId: {},
  activeFilter: "all",
  chatSearchQuery: "",
  messageSearchQuery: "",
  activeDesktopChatId: ""
};

const parseNumericId = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const sortMessages = (messages: ChatMessage[]): ChatMessage[] =>
  [...messages].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt);
    if (byDate !== 0) {
      return byDate;
    }
    return a.id.localeCompare(b.id);
  });

const withSession = (): { token: string; userId: string } => {
  const session = useAuthStore.getState().session;
  if (!session) {
    throw new Error("Missing session");
  }
  return { token: session.token, userId: session.userId };
};

const replaceMessage = (messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] => {
  const byId = messages.findIndex((message) => message.id === incoming.id);
  if (byId >= 0) {
    const next = [...messages];
    next[byId] = { ...next[byId], ...incoming };
    return sortMessages(next);
  }
  const byClientId =
    incoming.clientMessageId == null
      ? -1
      : messages.findIndex((message) => message.clientMessageId === incoming.clientMessageId);
  if (byClientId >= 0) {
    const next = [...messages];
    next[byClientId] = { ...next[byClientId], ...incoming };
    return sortMessages(next);
  }
  return sortMessages([...messages, incoming]);
};

let appStateAttached = false;
let documentVisibilityAttached = false;

const attachVisibilityWatchers = (): void => {
  if (!appStateAttached) {
    AppState.addEventListener("change", (nextState) => {
      useChatStore.getState().setAppVisibility(nextState === "active");
    });
    appStateAttached = true;
  }
  if (Platform.OS === "web" && typeof document !== "undefined" && !documentVisibilityAttached) {
    document.addEventListener("visibilitychange", () => {
      useChatStore.getState().setAppVisibility(!document.hidden);
    });
    documentVisibilityAttached = true;
  }
};

const updateChatById = (chats: ChatSummary[], chatId: string, updater: (chat: ChatSummary) => ChatSummary): ChatSummary[] => {
  let changed = false;
  const next = chats.map((chat) => {
    if (chat.id !== chatId) {
      return chat;
    }
    changed = true;
    return updater(chat);
  });
  return changed ? next : chats;
};

const mapApiDeliveryState = (value: ApiMessage["delivery_state"]): ChatMessage["status"] => {
  if (value === "queued") return "sending";
  if (value === "persisted") return "sent";
  if (value === "delivered") return "delivered";
  if (value === "read") return "seen";
  return "sent";
};

const nextChatsWithUnread = (
  chats: ChatSummary[],
  unreadByChatId: Record<string, number>,
  messagesByChat: Record<string, ChatMessage[]>
): ChatSummary[] => {
  const next = chats.map((chat) => ({
    ...chat,
    unreadCount: unreadByChatId[chat.id] ?? 0,
    lastMessageId: messagesByChat[chat.id]?.at(-1)?.id ?? chat.lastMessageId
  }));
  return sortChatsByLastActivity(next, messagesByChat);
};

const createOptimisticMessage = (payload: SendMessageInput, senderId: string, clientMessageId: string): ChatMessage => {
  const now = new Date().toISOString();
  return {
    id: `tmp_${clientMessageId}`,
    clientMessageId,
    chatId: payload.chatId,
    senderId,
    body: payload.body,
    type: payload.type,
    priority: payload.priority,
    createdAt: now,
    replyToMessageId: payload.replyToMessageId,
    attachment: payload.attachment,
    status: "sending",
    deliveredToIds: [],
    seenByIds: []
  };
};

const uploadAttachment = async (
  token: string,
  attachment: FileAttachment
): Promise<{
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  public_url?: string | null;
} | null> => {
  if (!attachment.uri) {
    return null;
  }

  const fileResponse = await fetch(attachment.uri);
  const blob = await fileResponse.blob();
  const fileName = attachment.name || `file-${Date.now()}`;
  const mimeType = attachment.mimeType || blob.type || "application/octet-stream";
  const sizeBytes = typeof blob.size === "number" ? blob.size : 0;
  if (sizeBytes <= 0) {
    return null;
  }

  if (USE_LOCAL_MEDIA_UPLOAD) {
    const formData = new FormData();
    formData.append("file", blob, fileName);
    const result = await messagesApi.uploadLocalAttachment(token, formData);
    return {
      bucket: result.bucket,
      object_key: result.object_key,
      original_name: result.original_name,
      mime_type: result.mime_type,
      size_bytes: result.size_bytes,
      public_url: result.public_url
    };
  }

  const presigned = await messagesApi.createUploadUrl(token, {
    filename: fileName,
    content_type: mimeType,
    size_bytes: sizeBytes
  });
  const uploadResponse = await fetch(presigned.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType
    },
    body: blob
  });
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload attachment.");
  }
  return {
    bucket: presigned.bucket,
    object_key: presigned.object_key,
    original_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    public_url: presigned.public_url
  };
};

const applyApiMessage = (
  state: ChatStore,
  apiMessage: ApiMessage,
  options: {
    incrementUnread: boolean;
  }
): Pick<ChatStore, "messagesByChat" | "chats" | "sharedFiles" | "unreadByChatId"> => {
  const chatId = String(apiMessage.conversation_id);
  const mapped = mapApiMessageToChatMessage(apiMessage);
  const existing = state.messagesByChat[chatId] ?? [];
  const wasExisting = existing.some(
    (message) => message.id === mapped.id || (message.clientMessageId && message.clientMessageId === mapped.clientMessageId)
  );
  const nextMessages = replaceMessage(existing, mapped);
  const messagesByChat = {
    ...state.messagesByChat,
    [chatId]: nextMessages
  };

  const unreadByChatId = {
    ...state.unreadByChatId
  };
  const isFromOtherUser = mapped.senderId !== state.currentUserId && mapped.senderId !== "system";
  const isActiveChat = state.activeConversationId === chatId && state.appVisible;
  if (options.incrementUnread && !wasExisting && isFromOtherUser && !isActiveChat) {
    unreadByChatId[chatId] = (unreadByChatId[chatId] ?? 0) + 1;
  }
  if (isActiveChat) {
    unreadByChatId[chatId] = 0;
  }

  const chats = nextChatsWithUnread(
    updateChatById(state.chats, chatId, (chat) => ({
      ...chat,
      lastMessageId: mapped.id
    })),
    unreadByChatId,
    messagesByChat
  );
  return {
    messagesByChat,
    chats,
    unreadByChatId,
    sharedFiles: deriveSharedFiles(messagesByChat)
  };
};

const updateUsersOnlineState = (users: User[], onlineUserIds: Set<number>): User[] =>
  users.map((user) => ({
    ...user,
    isOnline: onlineUserIds.has(Number(user.id))
  }));

const fetchAllUsers = async (token: string): Promise<ApiUser[]> => {
  const limit = 100;
  let offset = 0;
  const rows: ApiUser[] = [];
  const seen = new Set<number>();

  while (true) {
    const page = await usersApi.search(token, {
      includeSelf: true,
      limit,
      offset
    });

    page.forEach((user) => {
      if (seen.has(user.id)) {
        return;
      }
      seen.add(user.id);
      rows.push(user);
    });

    if (page.length < limit) {
      break;
    }
    offset += page.length;
  }

  return rows;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      ...initialPersisted,
      hydrated: false,
      initializing: false,
      users: [],
      chats: [],
      calls: [],
      sharedFiles: [],
      messagesByChat: {},
      loadingOlderByChat: {},
      loadedMessageLimitByChat: {},
      activeConversationId: "",
      websocketStatus: "idle",
      appVisible: true,
      currentToken: "",
      currentUserId: "",
      markHydrated: () => set({ hydrated: true }),
      initializeForSession: async () => {
        attachVisibilityWatchers();
        const session = useAuthStore.getState().session;
        if (!session) {
          realtimeSocketClient.disconnect();
          set({
            initializing: false,
            websocketStatus: "disconnected",
            currentToken: "",
            currentUserId: "",
            users: [],
            chats: [],
            sharedFiles: [],
            messagesByChat: {},
            loadingOlderByChat: {},
            loadedMessageLimitByChat: {},
            activeConversationId: "",
            calls: []
          });
          return;
        }

        const state = get();
        if (!state.initializing && state.currentToken === session.token && state.users.length > 0) {
          if (state.websocketStatus === "idle" || state.websocketStatus === "disconnected") {
            realtimeSocketClient.connect({
              token: session.token,
              onEvent: (envelope) => {
                useChatStore.getState().handleSocketEvent(envelope);
              },
              onStatusChange: (status) => set({ websocketStatus: status }),
              getActiveConversationId: () => parseNumericId(useChatStore.getState().activeConversationId)
            });
          }
          return;
        }

        set({
          initializing: true,
          currentToken: session.token,
          currentUserId: session.userId
        });

        try {
          const [apiSelf, apiUsers, onlineUserIds, apiConversations] = await Promise.all([
            usersApi.me(session.token),
            fetchAllUsers(session.token),
            presenceApi.getOnlineUsers(session.token, 5000),
            conversationsApi.list(session.token, { limit: 100, offset: 0 })
          ]);

          const onlineSet = new Set(onlineUserIds);
          const mappedUsers = apiUsers.map((user) => mapApiUserToUser(user, { onlineUserIds: onlineSet }));
          const mappedSelf = mapApiUserToUser(apiSelf, { onlineUserIds: onlineSet });
          const users = mappedUsers.some((user) => user.id === mappedSelf.id) ? mappedUsers : [...mappedUsers, mappedSelf];
          const usersById: Record<string, User> = Object.fromEntries(users.map((user) => [user.id, user] as const));

          const unreadByChatId = get().unreadByChatId;
          const chats = apiConversations.map((conversation) => {
            const conversationId = String(conversation.id);
            const mappedChat = mapApiConversationToChat(conversation, usersById, session.userId, {
              pinned: get().pinnedByChatId[conversationId] ?? false,
              archived: get().archivedByChatId[conversationId] ?? false,
              muted: get().mutedByChatId[conversationId] ?? false,
              unreadCount: unreadByChatId[conversationId] ?? 0
            });
            const overriddenKind = get().chatKindByConversationId[conversationId];
            return overriddenKind ? { ...mappedChat, kind: overriddenKind } : mappedChat;
          });

          const latestByConversation = await Promise.all(
            apiConversations.map(async (conversation) => {
              const latest = await messagesApi.getLatestByConversation(session.token, conversation.id);
              return { conversationId: String(conversation.id), latest };
            })
          );

          const messagesByChat: Record<string, ChatMessage[]> = {};
          latestByConversation.forEach((row) => {
            messagesByChat[row.conversationId] = row.latest ? [mapApiMessageToChatMessage(row.latest)] : [];
          });

          const sortedChats = nextChatsWithUnread(chats, unreadByChatId, messagesByChat);
          const activeDesktopChatId = (() => {
            const persistedChatId = get().activeDesktopChatId;
            if (persistedChatId && sortedChats.some((chat) => chat.id === persistedChatId)) {
              return persistedChatId;
            }
            return sortedChats.find((chat) => !chat.archived)?.id ?? sortedChats[0]?.id ?? "";
          })();

          set({
            users,
            chats: sortedChats,
            sharedFiles: deriveSharedFiles(messagesByChat),
            messagesByChat,
            loadingOlderByChat: {},
            loadedMessageLimitByChat: Object.fromEntries(sortedChats.map((chat) => [chat.id, INITIAL_MESSAGE_LIMIT] as const)),
            activeDesktopChatId,
            unreadByChatId: Object.fromEntries(sortedChats.map((chat) => [chat.id, chat.unreadCount] as const)),
            initializing: false
          });

          realtimeSocketClient.connect({
            token: session.token,
            onEvent: (envelope) => {
              useChatStore.getState().handleSocketEvent(envelope);
            },
            onStatusChange: (status) => set({ websocketStatus: status }),
            getActiveConversationId: () => parseNumericId(useChatStore.getState().activeConversationId)
          });

          await useAuthStore.getState().setCurrentUserFromApi(session.token);
        } catch (error) {
          set({ initializing: false });
          throw error;
        }
      },
      refreshChats: async () => {
        await get().initializeForSession();
      },
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      setChatSearchQuery: (query) => set({ chatSearchQuery: query }),
      setMessageSearchQuery: (query) => set({ messageSearchQuery: query }),
      setActiveDesktopChatId: (chatId) => set({ activeDesktopChatId: chatId }),
      setActiveConversationId: (chatId) => {
        const normalizedChatId = chatId || "";
        const state = get();
        if (state.activeConversationId === normalizedChatId) {
          return;
        }
        set({ activeConversationId: normalizedChatId });

        const token = state.currentToken || useAuthStore.getState().session?.token;
        if (!token) {
          return;
        }
        const numericId = parseNumericId(normalizedChatId);
        realtimeSocketClient.send("active_conversation", {
          conversation_id: numericId
        });
        presenceApi.setActiveConversation(token, numericId).catch(() => undefined);

        if (normalizedChatId) {
          get().markConversationRead(normalizedChatId).catch(() => undefined);
        }
      },
      setAppVisibility: (visible) => {
        const state = get();
        if (state.appVisible === visible) {
          return;
        }
        set({ appVisible: visible });

        const token = state.currentToken || useAuthStore.getState().session?.token;
        if (!token) {
          return;
        }

        if (!visible) {
          realtimeSocketClient.send("active_conversation", { conversation_id: null });
          presenceApi.setActiveConversation(token, null).catch(() => undefined);
          return;
        }

        const activeConversationId = useChatStore.getState().activeConversationId;
        const numericId = parseNumericId(activeConversationId);
        realtimeSocketClient.send("active_conversation", { conversation_id: numericId });
        presenceApi.setActiveConversation(token, numericId).catch(() => undefined);
        if (activeConversationId) {
          useChatStore.getState().markConversationRead(activeConversationId).catch(() => undefined);
        }
      },
      handleSocketEvent: (envelope) => {
        const event = envelope.event;
        const payload = envelope.payload ?? {};
        const state = get();

        if (event === "connected") {
          const onlineRaw = (payload as { online_users?: unknown }).online_users;
          if (Array.isArray(onlineRaw) && onlineRaw.every((item) => typeof item === "number")) {
            set({
              users: updateUsersOnlineState(state.users, new Set(onlineRaw))
            });
          }
          return;
        }

        if (event === "user_online" || event === "user_offline") {
          const userIdRaw = (payload as { user_id?: unknown }).user_id;
          if (typeof userIdRaw !== "number") {
            return;
          }
          const userId = String(userIdRaw);
          set({
            users: state.users.map((user) =>
              user.id === userId
                ? {
                    ...user,
                    isOnline: event === "user_online",
                    presence: event === "user_online" ? user.presence : "offline"
                  }
                : user
            )
          });
          return;
        }

        if (event === "last_seen_update") {
          const userIdRaw = (payload as { user_id?: unknown }).user_id;
          const lastSeenRaw = (payload as { last_seen?: unknown }).last_seen;
          if (typeof userIdRaw !== "number" || (lastSeenRaw != null && typeof lastSeenRaw !== "string")) {
            return;
          }
          const userId = String(userIdRaw);
          set({
            users: state.users.map((user) => (user.id === userId ? { ...user, lastSeenAt: lastSeenRaw ?? undefined } : user))
          });
          return;
        }

        if (event === "typing_start" || event === "typing_stop") {
          const conversationIdRaw = (payload as { conversation_id?: unknown }).conversation_id;
          const typingRaw = (payload as { typing_users?: unknown }).typing_users;
          if (
            typeof conversationIdRaw !== "number" ||
            !Array.isArray(typingRaw) ||
            !typingRaw.every((item) => typeof item === "number")
          ) {
            return;
          }
          const conversationId = String(conversationIdRaw);
          set({
            chats: updateChatById(state.chats, conversationId, (chat) => ({
              ...chat,
              typingUserIds: typingRaw.map((item) => String(item))
            }))
          });
          return;
        }

        if (event === "message_persisted" || event === "message_edited" || event === "message_deleted") {
          const apiMessage = payload as unknown as ApiMessage;
          if (typeof apiMessage?.conversation_id !== "number") {
            return;
          }
          const partial = applyApiMessage(state, apiMessage, {
            incrementUnread: event === "message_persisted"
          });
          set(partial);

          if (event === "message_persisted") {
            const senderId = apiMessage.sender_id != null ? String(apiMessage.sender_id) : "system";
            const current = get();
            const fromOther = senderId !== current.currentUserId && senderId !== "system";
            if (fromOther) {
              realtimeSocketClient.send("delivery_ack", { message_id: apiMessage.id });
              const isActive = current.activeConversationId === String(apiMessage.conversation_id) && current.appVisible;
              if (isActive) {
                realtimeSocketClient.send("read_receipt", { message_id: apiMessage.id });
                current.markConversationRead(String(apiMessage.conversation_id)).catch(() => undefined);
              }
            }
          }
          return;
        }

        if (event === "message_delivery_state") {
          const messageIdRaw = (payload as { message_id?: unknown }).message_id;
          const stateRaw = (payload as { state?: unknown }).state;
          if (typeof messageIdRaw !== "number" || typeof stateRaw !== "string") {
            return;
          }
          const messageId = String(messageIdRaw);
          const deliveryState = stateRaw as ApiMessage["delivery_state"];
          const messagesByChat: Record<string, ChatMessage[]> = {};
          let changed = false;
          Object.entries(state.messagesByChat).forEach(([chatId, messages]) => {
            let localChanged = false;
            const nextMessages = messages.map((message) => {
              if (message.id !== messageId) {
                return message;
              }
              localChanged = true;
              return {
                ...message,
                status: mapApiDeliveryState(deliveryState)
              };
            });
            messagesByChat[chatId] = localChanged ? nextMessages : messages;
            changed = changed || localChanged;
          });
          if (changed) {
            set({ messagesByChat });
          }
          return;
        }

        if (event === "message_read") {
          const messageIdRaw = (payload as { message_id?: unknown }).message_id;
          const userIdRaw = (payload as { user_id?: unknown }).user_id;
          if (typeof messageIdRaw !== "number" || typeof userIdRaw !== "number") {
            return;
          }
          const messageId = String(messageIdRaw);
          const readerId = String(userIdRaw);
          const messagesByChat: Record<string, ChatMessage[]> = {};
          let changed = false;
          Object.entries(state.messagesByChat).forEach(([chatId, messages]) => {
            let localChanged = false;
            const nextMessages = messages.map((message) => {
              if (message.id !== messageId) {
                return message;
              }
              localChanged = true;
              const seenByIds = message.seenByIds.includes(readerId)
                ? message.seenByIds
                : [...message.seenByIds, readerId];
              return {
                ...message,
                status: "seen" as ChatMessage["status"],
                seenByIds
              };
            });
            messagesByChat[chatId] = localChanged ? nextMessages : messages;
            changed = changed || localChanged;
          });
          if (changed) {
            set({ messagesByChat });
          }
          return;
        }

        if (event === "missed_messages") {
          const messagesRaw = (payload as { messages?: unknown }).messages;
          if (!Array.isArray(messagesRaw)) {
            return;
          }
          let nextState = get();
          messagesRaw.forEach((candidate) => {
            if (!candidate || typeof candidate !== "object") {
              return;
            }
            const partial = applyApiMessage(nextState, candidate as unknown as ApiMessage, {
              incrementUnread: true
            });
            nextState = { ...nextState, ...partial };
          });
          set({
            messagesByChat: nextState.messagesByChat,
            chats: nextState.chats,
            unreadByChatId: nextState.unreadByChatId,
            sharedFiles: nextState.sharedFiles
          });
        }
      },
      sendTypingEvent: (chatId, isTyping) => {
        const conversationId = parseNumericId(chatId);
        if (!conversationId) {
          return;
        }
        realtimeSocketClient.send(isTyping ? "typing_start" : "typing_stop", {
          conversation_id: conversationId
        });
      },
      sendMessage: async (payload) => {
        const { token, userId } = withSession();
        const conversationId = parseNumericId(payload.chatId);
        if (!conversationId) {
          throw new Error("Invalid chat id.");
        }

        const clientMessageId = createId("msg");
        const optimistic = createOptimisticMessage(payload, userId, clientMessageId);
        set((state) => {
          const currentMessages = state.messagesByChat[payload.chatId] ?? [];
          const messagesByChat = {
            ...state.messagesByChat,
            [payload.chatId]: sortMessages([...currentMessages, optimistic])
          };
          return {
            messagesByChat,
            chats: sortChatsByLastActivity(
              updateChatById(state.chats, payload.chatId, (chat) => ({
                ...chat,
                lastMessageId: optimistic.id
              })),
              messagesByChat
            ),
            sharedFiles: deriveSharedFiles(messagesByChat)
          };
        });

        const uploaded = payload.attachment ? await uploadAttachment(token, payload.attachment) : null;
        const attachments = uploaded ? [mapUploadAttachmentToApi(uploaded)] : [];

        realtimeSocketClient.send("send_message", {
          conversation_id: conversationId,
          content: payload.body || null,
          type: payload.type,
          client_message_id: clientMessageId,
          attachments
        });
      },
      editMessage: async (chatId, messageId, content) => {
        const { token } = withSession();
        const numericMessageId = parseNumericId(messageId);
        if (!numericMessageId) {
          return;
        }

        set((state) => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: (state.messagesByChat[chatId] ?? []).map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    body: content,
                    editedAt: new Date().toISOString()
                  }
                : message
            )
          }
        }));

        realtimeSocketClient.send("edit_message", {
          message_id: numericMessageId,
          content
        });
        messagesApi.editMessage(token, numericMessageId, content).catch(() => undefined);
      },
      deleteMessage: async (chatId, messageId) => {
        const { token } = withSession();
        const numericMessageId = parseNumericId(messageId);
        if (!numericMessageId) {
          return;
        }

        set((state) => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: (state.messagesByChat[chatId] ?? []).map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    body: "",
                    isDeleted: true,
                    status: "seen" as ChatMessage["status"]
                  }
                : message
            )
          }
        }));

        realtimeSocketClient.send("delete_message", {
          message_id: numericMessageId
        });
        messagesApi.deleteMessage(token, numericMessageId).catch(() => undefined);
      },
      forwardMessage: async (sourceChatId, messageId, targetChatId) => {
        const sourceMessage = get().messagesByChat[sourceChatId]?.find((message) => message.id === messageId);
        if (!sourceMessage || sourceMessage.isDeleted) {
          return;
        }
        await get().sendMessage({
          chatId: targetChatId,
          body: sourceMessage.body,
          type: "text",
          priority: "normal"
        });
      },
      loadOlderMessages: async (chatId) => {
        const state = get();
        const { token } = withSession();
        const conversationId = parseNumericId(chatId);
        if (!conversationId) {
          return;
        }
        if (state.loadingOlderByChat[chatId]) {
          return;
        }

        const currentLimit = state.loadedMessageLimitByChat[chatId] ?? INITIAL_MESSAGE_LIMIT;
        const nextLimit = currentLimit + MESSAGE_PAGE_SIZE;
        set({
          loadingOlderByChat: {
            ...state.loadingOlderByChat,
            [chatId]: true
          }
        });

        try {
          const apiMessages = await messagesApi.listByConversation(token, conversationId, {
            limit: nextLimit,
            offset: 0
          });
          const messagesByChat = {
            ...get().messagesByChat,
            [chatId]: sortMessages(apiMessages.map(mapApiMessageToChatMessage))
          };
          set({
            messagesByChat,
            sharedFiles: deriveSharedFiles(messagesByChat),
            loadedMessageLimitByChat: {
              ...get().loadedMessageLimitByChat,
              [chatId]: nextLimit
            }
          });
        } finally {
          set({
            loadingOlderByChat: {
              ...get().loadingOlderByChat,
              [chatId]: false
            }
          });
        }
      },
      markConversationRead: async (chatId) => {
        const { token, userId } = withSession();
        const state = get();
        const messages = state.messagesByChat[chatId] ?? [];
        const latestUnread = [...messages]
          .reverse()
          .find((message) => message.senderId !== userId && !message.isDeleted && message.status !== "seen");

        const unreadByChatId = {
          ...state.unreadByChatId,
          [chatId]: 0
        };
        const latestMessage = messages.at(-1);
        const lastRead = {
          ...state.lastReadMessageIdByChatId
        };
        if (latestMessage) {
          lastRead[chatId] = latestMessage.id;
        }

        set({
          unreadByChatId,
          lastReadMessageIdByChatId: lastRead,
          chats: updateChatById(state.chats, chatId, (chat) => ({
            ...chat,
            unreadCount: 0,
            hasMentions: false
          })),
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: messages.map((message) =>
              message.senderId !== userId
                ? {
                    ...message,
                    status: "seen" as ChatMessage["status"]
                  }
                : message
            )
          }
        });

        if (latestUnread) {
          const numericId = parseNumericId(latestUnread.id);
          if (numericId) {
            realtimeSocketClient.send("read_receipt", {
              message_id: numericId
            });
            messagesApi.markRead(token, numericId).catch(() => undefined);
          }
        }
      },
      togglePin: (chatId) =>
        set((state) => {
          const nextPinned = !(state.pinnedByChatId[chatId] ?? false);
          return {
            pinnedByChatId: {
              ...state.pinnedByChatId,
              [chatId]: nextPinned
            },
            chats: updateChatById(state.chats, chatId, (chat) => ({
              ...chat,
              pinned: nextPinned
            }))
          };
        }),
      toggleMute: (chatId) =>
        set((state) => {
          const nextMuted = !(state.mutedByChatId[chatId] ?? false);
          return {
            mutedByChatId: {
              ...state.mutedByChatId,
              [chatId]: nextMuted
            },
            chats: updateChatById(state.chats, chatId, (chat) => ({
              ...chat,
              muted: nextMuted
            }))
          };
        }),
      toggleArchive: (chatId) =>
        set((state) => {
          const nextArchived = !(state.archivedByChatId[chatId] ?? false);
          const chats = updateChatById(state.chats, chatId, (chat) => ({
            ...chat,
            archived: nextArchived
          }));
          return {
            archivedByChatId: {
              ...state.archivedByChatId,
              [chatId]: nextArchived
            },
            chats,
            activeDesktopChatId:
              state.activeDesktopChatId === chatId && nextArchived
                ? chats.find((chat) => !chat.archived)?.id ?? ""
                : state.activeDesktopChatId
          };
        }),
      startDirectConversation: async (userId) => {
        const { token, userId: currentUserId } = withSession();
        const state = get();
        const existing = state.chats.find(
          (chat) =>
            chat.kind === "direct" &&
            chat.memberIds.includes(currentUserId) &&
            chat.memberIds.includes(userId)
        );
        if (existing) {
          return existing.id;
        }

        const numericParticipantId = parseNumericId(userId);
        if (!numericParticipantId) {
          throw new Error("Invalid user id.");
        }
        const conversation = await conversationsApi.create(token, {
          type: "direct",
          participant_ids: [numericParticipantId]
        });
        const usersById = Object.fromEntries(state.users.map((user) => [user.id, user] as const));
        const chat = mapApiConversationToChat(conversation, usersById, currentUserId, {
          pinned: false,
          archived: false,
          muted: false,
          unreadCount: 0
        });
        const messagesByChat = {
          ...state.messagesByChat,
          [chat.id]: []
        };
        set({
          chats: sortChatsByLastActivity([...state.chats, chat], messagesByChat),
          messagesByChat,
          unreadByChatId: {
            ...state.unreadByChatId,
            [chat.id]: 0
          }
        });
        realtimeSocketClient.send("join_conversation", {
          conversation_id: Number(chat.id)
        });
        return chat.id;
      },
      createGroupConversation: async (payload) => {
        const { token, userId } = withSession();
        const state = get();
        const participantIds = payload.memberIds
          .map((memberId) => parseNumericId(memberId))
          .filter((memberId): memberId is number => typeof memberId === "number");

        const conversation = await conversationsApi.create(token, {
          type: "group",
          title: payload.title,
          participant_ids: participantIds
        });
        const usersById = Object.fromEntries(state.users.map((user) => [user.id, user] as const));
        const mapped = mapApiConversationToChat(conversation, usersById, userId, {
          pinned: false,
          archived: false,
          muted: false,
          unreadCount: 0
        });
        const chat = payload.kind === "group" ? mapped : { ...mapped, kind: payload.kind };
        const messagesByChat = {
          ...state.messagesByChat,
          [chat.id]: []
        };

        set({
          chats: sortChatsByLastActivity([...state.chats, chat], messagesByChat),
          messagesByChat,
          unreadByChatId: {
            ...state.unreadByChatId,
            [chat.id]: 0
          },
          chatKindByConversationId:
            payload.kind === "group"
              ? state.chatKindByConversationId
              : {
                  ...state.chatKindByConversationId,
                  [chat.id]: payload.kind
                }
        });
        realtimeSocketClient.send("join_conversation", {
          conversation_id: Number(chat.id)
        });
        return chat.id;
      },
      updateCurrentUserProfile: async (payload) => {
        const { token, userId } = withSession();
        const numericUserId = parseNumericId(userId);
        if (!numericUserId) {
          return;
        }

        const updatePayload: Parameters<typeof usersApi.updateMe>[1] = {};
        if (payload.fullName !== undefined) {
          updatePayload.full_name = payload.fullName;
        }
        if (payload.title !== undefined) {
          updatePayload.title = payload.title;
        }
        if (payload.about !== undefined) {
          updatePayload.about = payload.about;
        }
        if (payload.avatar !== undefined) {
          updatePayload.avatar_url = payload.avatar;
        }
        if (payload.presence !== undefined) {
          updatePayload.status = payload.presence;
        }

        const apiUser =
          Object.keys(updatePayload).length > 0
            ? await usersApi.updateMe(token, updatePayload)
            : await usersApi.me(token);
        const mapped = mapApiUserToUser(apiUser);

        set((state) => ({
          users: state.users.some((user) => user.id === mapped.id)
            ? state.users.map((user) => (user.id === mapped.id ? { ...user, ...mapped } : user))
            : [...state.users, mapped]
        }));

        useAuthStore.setState((state) => ({
          ...state,
          currentUser:
            state.currentUser.id === String(numericUserId)
              ? {
                  ...state.currentUser,
                  ...mapped
                }
              : state.currentUser
        }));
      }
    }),
    {
      name: "business-messenger-chat",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pinnedByChatId: state.pinnedByChatId,
        archivedByChatId: state.archivedByChatId,
        mutedByChatId: state.mutedByChatId,
        chatKindByConversationId: state.chatKindByConversationId,
        unreadByChatId: state.unreadByChatId,
        lastReadMessageIdByChatId: state.lastReadMessageIdByChatId,
        activeFilter: state.activeFilter,
        chatSearchQuery: state.chatSearchQuery,
        messageSearchQuery: state.messageSearchQuery,
        activeDesktopChatId: state.activeDesktopChatId
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
