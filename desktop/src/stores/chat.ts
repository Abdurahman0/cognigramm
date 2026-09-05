import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** How long a `typing_start` stands without a matching stop. */
const TYPING_TTL_MS = 6_000

interface ChatState {
  activeConversationId: number | null
  /** conversationId -> userIds currently typing */
  typingByConversation: Record<number, number[]>
  /** conversationId -> unread count, cleared when the transcript is opened */
  unreadByConversation: Record<number, number>
  /** conversationId -> unsent composer text, kept across navigation and restarts */
  draftByConversation: Record<number, string>
  onlineUserIds: number[]
  replyTo: { conversationId: number; messageId: number; preview: string } | null

  setActiveConversation: (conversationId: number | null) => void
  setTyping: (conversationId: number, userId: number, isTyping: boolean) => void
  clearTyping: (conversationId: number) => void
  bumpUnread: (conversationId: number) => void
  clearUnread: (conversationId: number) => void
  setDraft: (conversationId: number, value: string) => void
  setOnlineUsers: (userIds: number[]) => void
  setUserOnline: (userId: number, isOnline: boolean) => void
  setReplyTo: (value: ChatState['replyTo']) => void
  reset: () => void
}

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      activeConversationId: null,
      typingByConversation: {},
      unreadByConversation: {},
      draftByConversation: {},
      onlineUserIds: [],
      replyTo: null,

      setActiveConversation: (activeConversationId) => set({ activeConversationId, replyTo: null }),

      setTyping: (conversationId, userId, isTyping) => {
        const key = `${conversationId}:${userId}`
        const existing = typingTimers.get(key)
        if (existing) {
          clearTimeout(existing)
          typingTimers.delete(key)
        }

        set((state) => {
          const current = state.typingByConversation[conversationId] ?? []
          const next = isTyping
            ? current.includes(userId)
              ? current
              : [...current, userId]
            : current.filter((id) => id !== userId)
          if (next === current) return state
          return {
            typingByConversation: { ...state.typingByConversation, [conversationId]: next },
          }
        })

        // A dropped `typing_stop` would otherwise leave the indicator on
        // forever, so every start carries its own expiry.
        if (isTyping) {
          typingTimers.set(
            key,
            setTimeout(() => {
              typingTimers.delete(key)
              get().setTyping(conversationId, userId, false)
            }, TYPING_TTL_MS),
          )
        }
      },

      clearTyping: (conversationId) =>
        set((state) => ({
          typingByConversation: { ...state.typingByConversation, [conversationId]: [] },
        })),

      bumpUnread: (conversationId) =>
        set((state) => ({
          unreadByConversation: {
            ...state.unreadByConversation,
            [conversationId]: (state.unreadByConversation[conversationId] ?? 0) + 1,
          },
        })),

      clearUnread: (conversationId) =>
        set((state) => {
          if (!state.unreadByConversation[conversationId]) return state
          const next = { ...state.unreadByConversation }
          delete next[conversationId]
          return { unreadByConversation: next }
        }),

      setDraft: (conversationId, value) =>
        set((state) => {
          const drafts = { ...state.draftByConversation }
          if (value.trim()) drafts[conversationId] = value
          else delete drafts[conversationId]
          return { draftByConversation: drafts }
        }),

      // Guarded: a proxy or gateway that answers with something other than an
      // array must not take the whole window down with it.
      setOnlineUsers: (onlineUserIds) =>
        set({ onlineUserIds: Array.isArray(onlineUserIds) ? onlineUserIds : [] }),

      setUserOnline: (userId, isOnline) =>
        set((state) => {
          const has = state.onlineUserIds.includes(userId)
          if (isOnline === has) return state
          return {
            onlineUserIds: isOnline
              ? [...state.onlineUserIds, userId]
              : state.onlineUserIds.filter((id) => id !== userId),
          }
        }),

      setReplyTo: (replyTo) => set({ replyTo }),

      reset: () =>
        set({
          activeConversationId: null,
          typingByConversation: {},
          unreadByConversation: {},
          onlineUserIds: [],
          replyTo: null,
        }),
    }),
    {
      name: 'qq.chat',
      storage: createJSONStorage(() => localStorage),
      // Drafts and unread badges are worth keeping; live presence and typing
      // are only true while the socket is up.
      partialize: (state) => ({
        draftByConversation: state.draftByConversation,
        unreadByConversation: state.unreadByConversation,
      }),
    },
  ),
)
