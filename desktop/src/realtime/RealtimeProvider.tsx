import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'

import { toMessage } from '@/api/adapters'
import { forgetCursor, recoverConversation, recoverConversations } from '@/api/change-feed'
import { rememberAttachmentUrls } from '@/api/media-urls'
import { applyDeliveryById, patchMessage, upsertMessage } from '@/api/message-cache'
import { queryKeys } from '@/api/query-keys'
import { ensureAccessToken, scheduleProactiveRefresh } from '@/api/session'
import type { ApiConversation } from '@/api/types'
import type { DeliveryStatePayload } from '@/realtime/events'
import type { DeliveryState } from '@/types'
import { toast } from '@/components/ui/toast'
import { initCallEngine } from '@/features/calls/call-engine'
import { isWindowFocused, notify } from '@/lib/notify'
import { realtime } from '@/realtime/socket'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

/** How often an open conversation re-checks the change feed for missed events. */
const RECOVERY_INTERVAL_MS = 60_000

const errorText = (detail: unknown): string => {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined
    if (first?.msg) return first.msg
  }
  return 'Unknown error'
}

/**
 * The one place server events become client state.
 *
 * Handlers are registered once for the whole session rather than per screen:
 * an unread badge or a delivery tick has to update whether or not the chat it
 * belongs to is currently mounted.
 *
 * Ordering between the socket and REST is not coordinated on purpose. Every
 * write goes through the message cache, which merges by id and never lets
 * delivery state move backwards, so a socket event that overtakes the history
 * request it belongs to is simply an upsert that arrives early.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const status = useAuthStore((state) => state.status)
  const presenceSessionId = useAuthStore((state) => state.presenceSessionId)
  const deviceId = useAuthStore((state) => state.deviceId)
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)
  const isAuthenticated = status === 'authenticated'

  // Keep the access token ahead of its 15-minute expiry: the socket is opened
  // with a token in its URL, so a stale one would fail every reconnect.
  useEffect(() => {
    if (!isAuthenticated) return
    return scheduleProactiveRefresh()
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      realtime.disconnect()
      return
    }
    realtime.connect({
      getToken: ensureAccessToken,
      sessionId: presenceSessionId,
      deviceId,
    })
    return () => realtime.disconnect()
  }, [isAuthenticated, presenceSessionId, deviceId])

  // Call signalling is its own concern, but shares this socket and lifetime.
  useEffect(() => {
    if (!isAuthenticated || currentUserId < 0) return
    return initCallEngine(currentUserId)
  }, [isAuthenticated, currentUserId])

  useEffect(() => {
    if (!isAuthenticated) return
    const chat = useChatStore.getState
    const unsubscribers: Array<() => void> = []

    unsubscribers.push(
      realtime.on('connected', (payload) => {
        chat().setOnlineUsers(payload.online_users ?? [])
        const active = chat().activeConversationId
        if (active !== null) realtime.setActiveConversation(active)
      }),
    )

    // ---- message lifecycle -------------------------------------------------
    const ingest = (raw: Parameters<typeof toMessage>[0], options: { announce?: boolean } = {}) => {
      const message = toMessage(raw)
      // Attachments arrive with a signed URL already; caching it here saves a
      // `/files/access` round trip per image when the bubble renders.
      rememberAttachmentUrls(message.attachments)
      upsertMessage(queryClient, message)

      const isMine = message.senderId === currentUserId
      const isOpen = chat().activeConversationId === message.conversationId

      if (!isMine && !isOpen) chat().bumpUnread(message.conversationId)

      if (options.announce && !isMine && (!isOpen || !isWindowFocused())) {
        void notify({
          title: message.senderName ?? 'New message',
          body: message.body || `Sent ${message.kind.replace('_', ' ')}`,
        })
      }

      // The conversation list reads its preview line from this key, which is
      // why it never needs to refetch to stay current.
      queryClient.setQueryData(queryKeys.latestMessage(message.conversationId), message)
    }

    // `message_queued` is an acknowledgement, not a message: the broker has
    // accepted it and nothing is persisted yet. The optimistic row stays in
    // its "sending" state, which is exactly what the tick marks promise.
    unsubscribers.push(
      realtime.on('message_queued', (payload) => {
        patchMessage(
          queryClient,
          payload.conversation_id,
          (message) => message.clientMessageId === payload.client_message_id,
          { delivery: 'sending', error: undefined },
        )
      }),
    )

    unsubscribers.push(realtime.on('message_persisted', (raw) => ingest(raw, { announce: true })))

    // The ack carries the id the database assigned. `message_persisted`
    // normally arrives with the full row as well, but the ack is the one event
    // guaranteed to reach the sender, so it is what binds client id to id.
    unsubscribers.push(
      realtime.on('message_persisted_ack', (payload) => {
        patchMessage(
          queryClient,
          payload.conversation_id,
          (message) => message.clientMessageId === payload.client_message_id,
          { id: payload.message_id, delivery: 'sent', pending: false, error: undefined },
        )
      }),
    )

    unsubscribers.push(realtime.on('message_edited', (raw) => ingest(raw)))

    unsubscribers.push(
      realtime.on('message_deleted', (raw) => {
        const message = toMessage(raw)
        upsertMessage(queryClient, { ...message, isDeleted: true, body: '', attachments: [] })
      }),
    )

    unsubscribers.push(
      realtime.on('message_pinned', (raw) => {
        const message = toMessage(raw)
        upsertMessage(queryClient, { ...message, isPinned: true })
        void queryClient.invalidateQueries({ queryKey: queryKeys.pinned(message.conversationId) })
      }),
    )

    unsubscribers.push(
      realtime.on('message_unpinned', (raw) => {
        const message = toMessage(raw)
        upsertMessage(queryClient, { ...message, isPinned: false })
        void queryClient.invalidateQueries({ queryKey: queryKeys.pinned(message.conversationId) })
      }),
    )

    unsubscribers.push(
      realtime.on('message_retrying', (payload) => {
        const conversationId = chat().activeConversationId
        if (conversationId === null) return
        patchMessage(
          queryClient,
          conversationId,
          (message) => message.clientMessageId === payload.client_message_id,
          { delivery: 'sending', error: undefined },
        )
      }),
    )

    unsubscribers.push(
      realtime.on('message_failed', (payload) => {
        const conversationId = chat().activeConversationId
        if (conversationId === null) return
        patchMessage(
          queryClient,
          conversationId,
          (message) => message.clientMessageId === payload.client_message_id,
          { delivery: 'failed', pending: false, error: payload.detail ?? 'Not delivered' },
        )
        toast.error('Message not delivered', payload.detail)
      }),
    )

    /**
     * Delivery updates arrive in two spellings — `state` on the wire for
     * `message_delivery_state`, `delivery_state` in the documented shape — and
     * without a conversation id, so the message is found by scanning the
     * loaded transcripts.
     */
    const applyDelivery = (payload: DeliveryStatePayload, override?: DeliveryState) => {
      const raw = payload.state ?? payload.delivery_state
      const incoming: DeliveryState =
        override ??
        (raw === 'queued'
          ? 'sending'
          : raw === 'persisted'
            ? 'sent'
            : raw === 'delivered'
              ? 'delivered'
              : raw === 'read'
                ? 'read'
                : raw === 'failed'
                  ? 'failed'
                  : 'sent')
      if (!Number.isFinite(payload.message_id)) return
      applyDeliveryById(queryClient, payload.message_id, incoming)
    }

    unsubscribers.push(realtime.on('message_delivery_state', (payload) => applyDelivery(payload)))
    unsubscribers.push(
      realtime.on('message_delivered', (payload) => applyDelivery(payload, 'delivered')),
    )
    unsubscribers.push(realtime.on('message_read', (payload) => applyDelivery(payload, 'read')))

    unsubscribers.push(
      realtime.on('missed_messages', (payload) => {
        for (const raw of payload.messages ?? []) ingest(raw)
      }),
    )

    // ---- membership --------------------------------------------------------
    const refreshConversations = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })

    unsubscribers.push(
      realtime.on('conversation_created', (conversation: ApiConversation) => {
        queryClient.setQueryData<ApiConversation[]>(queryKeys.conversations, (previous) => {
          const rows = previous ?? []
          return rows.some((row) => row.id === conversation.id) ? rows : [conversation, ...rows]
        })
        // The socket only auto-joins rooms it knows about at connect time.
        realtime.joinConversation(conversation.id)
      }),
    )
    unsubscribers.push(
      realtime.on('conversation_members_added', (conversation: ApiConversation) => {
        refreshConversations()
        if (conversation?.id) realtime.joinConversation(conversation.id)
      }),
    )
    unsubscribers.push(realtime.on('conversation_member_removed', refreshConversations))
    unsubscribers.push(
      realtime.on('conversation_removed', (payload) => {
        queryClient.removeQueries({ queryKey: queryKeys.messages(payload.conversation_id) })
        forgetCursor(payload.conversation_id)
        refreshConversations()
        if (chat().activeConversationId === payload.conversation_id) {
          chat().setActiveConversation(null)
          toast.info('Removed from conversation')
        }
      }),
    )

    // ---- typing and presence ----------------------------------------------
    unsubscribers.push(
      realtime.on('typing_start', (payload) => {
        if (payload.user_id === currentUserId) return
        chat().setTyping(payload.conversation_id, payload.user_id, true)
      }),
    )
    unsubscribers.push(
      realtime.on('typing_stop', (payload) => {
        chat().setTyping(payload.conversation_id, payload.user_id, false)
      }),
    )
    unsubscribers.push(
      realtime.on('user_online', (payload) => chat().setUserOnline(payload.user_id, true)),
    )
    unsubscribers.push(
      realtime.on('user_offline', (payload) => chat().setUserOnline(payload.user_id, false)),
    )

    // ---- errors ------------------------------------------------------------
    unsubscribers.push(
      realtime.on('error', (payload) => toast.error('Server error', errorText(payload.detail))),
    )
    unsubscribers.push(
      realtime.on('rate_limited', (payload) => toast.error('Slow down', errorText(payload.detail))),
    )

    // ---- recovery ----------------------------------------------------------
    // Redis can drop an event while the socket is down. On every reconnect the
    // client replays the change feed for the conversations it knows about, and
    // reloads the list, rather than trusting that nothing was missed.
    unsubscribers.push(
      realtime.onReconnected(() => {
        refreshConversations()
        const active = chat().activeConversationId
        const known = queryClient.getQueryData<ApiConversation[]>(queryKeys.conversations) ?? []
        const ids = known.map((row) => row.id)
        void recoverConversations(queryClient, active !== null ? [active, ...ids] : ids)
        if (active !== null) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.messages(active) })
        }
      }),
    )

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [isAuthenticated, queryClient, currentUserId])

  // A long-open window can also miss events without the socket ever closing —
  // a worker restart, a Redis blip. The open conversation re-checks on a timer.
  useEffect(() => {
    if (!isAuthenticated) return
    const timer = setInterval(() => {
      const active = useChatStore.getState().activeConversationId
      if (active === null || !isWindowFocused()) return
      void recoverConversation(queryClient, active)
    }, RECOVERY_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isAuthenticated, queryClient])

  return <>{children}</>
}
