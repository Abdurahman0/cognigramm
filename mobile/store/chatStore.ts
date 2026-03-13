import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  CURRENT_USER_ID,
  mockCallLogs,
  mockChats,
  mockMessages,
  mockSharedFiles,
  mockUsers
} from "@/mock";
import { useAuthStore } from "@/store/authStore";
import type {
  CallLogItem,
  ChatMessage,
  ChatSummary,
  FileAttachment,
  MessagePriority,
  MessageType,
  SharedFileItem,
  User
} from "@/types";
import { createId } from "@/utils/ids";

export type ChatFilterKey = "all" | "unread" | "channels" | "groups" | "archived" | "pinned";

interface SendMessagePayload {
  chatId: string;
  body: string;
  type: MessageType;
  priority: MessagePriority;
  attachment?: FileAttachment;
  replyToMessageId?: string;
}

interface IncomingMessagePayload {
  chatId: string;
  senderId: string;
  body: string;
  type?: MessageType;
  priority?: MessagePriority;
  attachment?: FileAttachment;
  status?: ChatMessage["status"];
  createdAt?: string;
  id?: string;
  replyToMessageId?: string;
}

interface CreateGroupPayload {
  title: string;
  memberIds: string[];
  kind?: "group" | "channel";
}

interface ChatStoreState {
  hydrated: boolean;
  users: User[];
  chats: ChatSummary[];
  messagesByChat: Record<string, ChatMessage[]>;
  calls: CallLogItem[];
  sharedFiles: SharedFileItem[];
  activeFilter: ChatFilterKey;
  chatSearchQuery: string;
  messageSearchQuery: string;
  activeDesktopChatId: string;
  activeConversationId: string;
  loadingOlderByChat: Record<string, boolean>;
  markHydrated: () => void;
  setActiveFilter: (filter: ChatFilterKey) => void;
  setChatSearchQuery: (query: string) => void;
  setMessageSearchQuery: (query: string) => void;
  setActiveDesktopChatId: (chatId: string) => void;
  setActiveConversationId: (chatId: string) => void;
  refreshChats: () => Promise<void>;
  loadOlderMessages: (chatId: string) => Promise<void>;
  sendMessage: (payload: SendMessagePayload) => void;
  addIncomingMessage: (payload: IncomingMessagePayload) => void;
  injectIncomingMessage: (chatId: string, senderId: string, body: string) => void;
  editMessage: (chatId: string, messageId: string, body: string) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  forwardMessage: (sourceChatId: string, messageId: string, targetChatId: string) => void;
  togglePin: (chatId: string) => void;
  toggleArchive: (chatId: string) => void;
  toggleMute: (chatId: string) => void;
  markConversationRead: (chatId: string) => void;
  markChatRead: (chatId: string) => void;
  updateTypingState: (chatId: string, userIds: string[]) => void;
  setTyping: (chatId: string, userIds: string[]) => void;
  simulateTyping: (chatId: string, userId: string, ms?: number) => void;
  appendOlderMessages: (chatId: string, messages: ChatMessage[]) => void;
  updateDeliveryStatus: (
    chatId: string,
    messageId: string,
    status: ChatMessage["status"],
    meta?: { seenByIds?: string[]; deliveredToIds?: string[] }
  ) => void;
  updatePresence: (
    userId: string,
    patch: Partial<Pick<User, "presence" | "isOnline" | "lastSeenAt">>
  ) => void;
  createGroupConversation: (payload: CreateGroupPayload) => string;
  startDirectConversation: (participantId: string) => string;
  updateCurrentUserProfile: (patch: Partial<User>) => void;
}

const deepCloneMessages = (): Record<string, ChatMessage[]> =>
  Object.fromEntries(
    Object.entries(mockMessages).map(([key, value]) => [key, value.map((message) => ({ ...message }))])
  );

const sortChatsByLastActivity = (chats: ChatSummary[], messagesByChat: Record<string, ChatMessage[]>): ChatSummary[] => {
  return [...chats].sort((a, b) => {
    const messagesA = messagesByChat[a.id] ?? [];
    const messagesB = messagesByChat[b.id] ?? [];
    const lastA = messagesA[messagesA.length - 1]?.createdAt ?? "";
    const lastB = messagesB[messagesB.length - 1]?.createdAt ?? "";
    const byTime = lastB.localeCompare(lastA);
    if (byTime !== 0) {
      return byTime;
    }
    return a.title.localeCompare(b.title);
  });
};

const createInitialState = () => {
  const messagesByChat = deepCloneMessages();
  const chats = sortChatsByLastActivity(mockChats.map((chat) => ({ ...chat })), messagesByChat);
  return {
    users: mockUsers.map((user) => ({ ...user })),
    chats,
    messagesByChat,
    calls: mockCallLogs.map((call) => ({ ...call })),
    sharedFiles: mockSharedFiles.map((file) => ({ ...file }))
  };
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const uniqueByMessageId = (messages: ChatMessage[]): ChatMessage[] => {
  const map = new Map<string, ChatMessage>();
  messages.forEach((message) => {
    map.set(message.id, message);
  });
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...createInitialState(),
      activeFilter: "all",
      chatSearchQuery: "",
      messageSearchQuery: "",
      activeDesktopChatId: "chat_eng_channel",
      activeConversationId: "",
      loadingOlderByChat: {},
      markHydrated: () => set({ hydrated: true }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      setChatSearchQuery: (query) => set({ chatSearchQuery: query }),
      setMessageSearchQuery: (query) => set({ messageSearchQuery: query }),
      setActiveDesktopChatId: (chatId) => set({ activeDesktopChatId: chatId, activeConversationId: chatId }),
      setActiveConversationId: (chatId) => set({ activeConversationId: chatId }),
      refreshChats: async () => {
        await wait(700);
        set((state) => {
          const chats = state.chats.map((chat) =>
            chat.id === "chat_eng_channel"
              ? {
                  ...chat,
                  unreadCount: Math.min(chat.unreadCount + 1, 9),
                  typingUserIds: ["u_dev_2"]
                }
              : chat
          );
          return { chats: sortChatsByLastActivity(chats, state.messagesByChat) };
        });
      },
      loadOlderMessages: async (chatId) => {
        set((state) => ({
          loadingOlderByChat: { ...state.loadingOlderByChat, [chatId]: true }
        }));
        await wait(600);
        const existing = get().messagesByChat[chatId] ?? [];
        const oldestTs = existing[0]?.createdAt ? new Date(existing[0].createdAt).getTime() : Date.now();
        const generated: ChatMessage[] = Array.from({ length: 15 }).map((_, index) => {
          const timestamp = new Date(oldestTs - (index + 1) * 18 * 60 * 1000).toISOString();
          return {
            id: createId("hist"),
            chatId,
            senderId: index % 2 ? "u_dev_1" : "u_amina",
            body: `Historical update ${index + 1} for context and decision tracking.`,
            type: "text",
            priority: "normal",
            createdAt: timestamp,
            status: "seen",
            seenByIds: ["u_amina"],
            deliveredToIds: []
          };
        });

        get().appendOlderMessages(chatId, generated.reverse());
        set((state) => ({
          loadingOlderByChat: { ...state.loadingOlderByChat, [chatId]: false }
        }));
      },
      sendMessage: (payload) => {
        const loggedUserId = useAuthStore.getState().session?.userId ?? CURRENT_USER_ID;
        const message: ChatMessage = {
          id: createId("msg"),
          chatId: payload.chatId,
          senderId: loggedUserId,
          body: payload.body,
          type: payload.type,
          priority: payload.priority,
          createdAt: new Date().toISOString(),
          status: "seen",
          seenByIds: [loggedUserId],
          deliveredToIds: [],
          attachment: payload.attachment,
          replyToMessageId: payload.replyToMessageId
        };

        set((state) => {
          const chatMessages = state.messagesByChat[payload.chatId] ?? [];
          const nextMessagesByChat = {
            ...state.messagesByChat,
            [payload.chatId]: [...chatMessages, message]
          };
          const chats = state.chats.map((chat) =>
            chat.id === payload.chatId
              ? { ...chat, lastMessageId: message.id, unreadCount: 0, typingUserIds: [] }
              : chat
          );
          return {
            messagesByChat: nextMessagesByChat,
            chats: sortChatsByLastActivity(chats, nextMessagesByChat)
          };
        });

        if (payload.type === "file" || payload.type === "image" || payload.type === "voice") {
          set((state) => ({
            sharedFiles: [
              ...state.sharedFiles,
              {
                id: createId("file"),
                chatId: payload.chatId,
                ownerId: loggedUserId,
                title: payload.attachment?.name ?? (payload.type === "voice" ? "Voice note.m4a" : "attachment"),
                type:
                  payload.type === "voice"
                    ? "voice"
                    : payload.type === "image"
                    ? "image"
                    : "document",
                sizeLabel: payload.attachment?.sizeLabel ?? "0.8 MB",
                uploadedAt: new Date().toISOString()
              }
            ]
          }));
        }
      },
      addIncomingMessage: (payload) => {
        const viewerId = useAuthStore.getState().session?.userId ?? CURRENT_USER_ID;
        set((state) => {
          const isActiveChat =
            state.activeConversationId === payload.chatId || state.activeDesktopChatId === payload.chatId;
          const status = payload.status ?? (isActiveChat ? "seen" : "delivered");
          const message: ChatMessage = {
            id: payload.id ?? createId("msg"),
            chatId: payload.chatId,
            senderId: payload.senderId,
            body: payload.body,
            type: payload.type ?? "text",
            priority: payload.priority ?? "normal",
            createdAt: payload.createdAt ?? new Date().toISOString(),
            status,
            seenByIds: status === "seen" ? [viewerId] : [],
            deliveredToIds: [],
            attachment: payload.attachment,
            replyToMessageId: payload.replyToMessageId
          };

          const nextMessagesByChat = {
            ...state.messagesByChat,
            [payload.chatId]: [...(state.messagesByChat[payload.chatId] ?? []), message]
          };
          const chats = state.chats.map((chat) =>
            chat.id === payload.chatId
              ? {
                  ...chat,
                  lastMessageId: message.id,
                  unreadCount: isActiveChat ? 0 : Math.min(chat.unreadCount + 1, 99),
                  typingUserIds: chat.typingUserIds.filter((id) => id !== payload.senderId)
                }
              : chat
          );

          return {
            messagesByChat: nextMessagesByChat,
            chats: sortChatsByLastActivity(chats, nextMessagesByChat)
          };
        });
      },
      injectIncomingMessage: (chatId, senderId, body) => {
        get().addIncomingMessage({
          chatId,
          senderId,
          body,
        });
      },
      editMessage: (chatId, messageId, body) => {
        set((state) => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: (state.messagesByChat[chatId] ?? []).map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    body,
                    editedAt: new Date().toISOString()
                  }
                : message
            )
          }
        }));
      },
      deleteMessage: (chatId, messageId) => {
        set((state) => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: (state.messagesByChat[chatId] ?? []).map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    body: "",
                    isDeleted: true,
                    editedAt: new Date().toISOString()
                  }
                : message
            )
          }
        }));
      },
      forwardMessage: (sourceChatId, messageId, targetChatId) => {
        const sourceMessage = (get().messagesByChat[sourceChatId] ?? []).find((message) => message.id === messageId);
        if (!sourceMessage) {
          return;
        }
        get().sendMessage({
          chatId: targetChatId,
          body: sourceMessage.body || "Forwarded message",
          type: sourceMessage.type,
          priority: "normal",
          attachment: sourceMessage.attachment,
          replyToMessageId: undefined
        });
      },
      togglePin: (chatId) => {
        set((state) => {
          const chats = state.chats.map((chat) => (chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat));
          return { chats: sortChatsByLastActivity(chats, state.messagesByChat) };
        });
      },
      toggleArchive: (chatId) => {
        set((state) => ({
          chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, archived: !chat.archived } : chat))
        }));
      },
      toggleMute: (chatId) => {
        set((state) => ({
          chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, muted: !chat.muted } : chat))
        }));
      },
      markConversationRead: (chatId) => {
        set((state) => ({
          chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat))
        }));
      },
      markChatRead: (chatId) => {
        get().markConversationRead(chatId);
      },
      updateTypingState: (chatId, userIds) => {
        set((state) => ({
          chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, typingUserIds: userIds } : chat))
        }));
      },
      setTyping: (chatId, userIds) => {
        get().updateTypingState(chatId, userIds);
      },
      simulateTyping: (chatId, userId, ms = 2200) => {
        const existing = get()
          .chats.find((chat) => chat.id === chatId)
          ?.typingUserIds.filter((id) => id !== userId);
        get().setTyping(chatId, [...(existing ?? []), userId]);
        setTimeout(() => {
          const chat = get().chats.find((item) => item.id === chatId);
          if (!chat) {
            return;
          }
          get().setTyping(
            chatId,
            chat.typingUserIds.filter((id) => id !== userId)
          );
        }, ms);
      },
      appendOlderMessages: (chatId, messages) => {
        if (messages.length === 0) {
          return;
        }
        set((state) => {
          const existing = state.messagesByChat[chatId] ?? [];
          return {
            messagesByChat: {
              ...state.messagesByChat,
              [chatId]: uniqueByMessageId([...messages, ...existing])
            }
          };
        });
      },
      updateDeliveryStatus: (chatId, messageId, status, meta) => {
        set((state) => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: (state.messagesByChat[chatId] ?? []).map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    status,
                    seenByIds: meta?.seenByIds ?? message.seenByIds,
                    deliveredToIds: meta?.deliveredToIds ?? message.deliveredToIds
                  }
                : message
            )
          }
        }));
      },
      updatePresence: (userId, patch) => {
        set((state) => ({
          users: state.users.map((user) => (user.id === userId ? { ...user, ...patch } : user))
        }));
      },
      createGroupConversation: (payload) => {
        const nextId = createId("chat");
        const currentUserId = useAuthStore.getState().session?.userId ?? CURRENT_USER_ID;
        const nextChat: ChatSummary = {
          id: nextId,
          title: payload.title,
          kind: payload.kind ?? "group",
          memberIds: [currentUserId, ...payload.memberIds],
          unreadCount: 0,
          pinned: false,
          archived: false,
          muted: false,
          typingUserIds: [],
          subtitle: payload.kind === "channel" ? "Department channel" : "New team group"
        };
        const welcomeMessage: ChatMessage = {
          id: createId("msg"),
          chatId: nextId,
          senderId: currentUserId,
          body: payload.kind === "channel" ? "Channel created." : "Group created.",
          type: "system",
          priority: "normal",
          createdAt: new Date().toISOString(),
          status: "seen",
          seenByIds: [currentUserId],
          deliveredToIds: []
        };

        set((state) => {
          const messagesByChat = { ...state.messagesByChat, [nextId]: [welcomeMessage] };
          const chats = sortChatsByLastActivity([nextChat, ...state.chats], messagesByChat);
          return { chats, messagesByChat };
        });
        return nextId;
      },
      startDirectConversation: (participantId) => {
        const currentUserId = useAuthStore.getState().session?.userId ?? CURRENT_USER_ID;
        const existing = get().chats.find(
          (chat) =>
            chat.kind === "direct" &&
            chat.memberIds.includes(currentUserId) &&
            chat.memberIds.includes(participantId) &&
            chat.memberIds.length === 2
        );
        if (existing) {
          return existing.id;
        }
        const user = get().users.find((item) => item.id === participantId);
        const nextId = createId("chat");
        const nextChat: ChatSummary = {
          id: nextId,
          title: user?.fullName ?? "Direct Message",
          kind: "direct",
          memberIds: [currentUserId, participantId],
          unreadCount: 0,
          pinned: false,
          archived: false,
          muted: false,
          typingUserIds: []
        };
        set((state) => {
          const messagesByChat = { ...state.messagesByChat, [nextId]: [] };
          const chats = sortChatsByLastActivity([nextChat, ...state.chats], messagesByChat);
          return { chats, messagesByChat };
        });
        return nextId;
      },
      updateCurrentUserProfile: (patch) => {
        const currentUserId = useAuthStore.getState().session?.userId ?? CURRENT_USER_ID;
        set((state) => {
          const users = state.users.map((user) => (user.id === currentUserId ? { ...user, ...patch } : user));
          return { users };
        });
      }
    }),
    {
      name: "business-messenger-chat",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        users: state.users,
        chats: state.chats,
        messagesByChat: state.messagesByChat,
        calls: state.calls,
        sharedFiles: state.sharedFiles,
        activeDesktopChatId: state.activeDesktopChatId
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
