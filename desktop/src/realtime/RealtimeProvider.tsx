import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'

import { toMessage } from '@/api/adapters'
import { advanceDelivery, patchMessage, upsertMessage } from '@/api/message-cache'
import { queryKeys } from '@/api/query-keys'
import { toast } from '@/components/ui/toast'
import { initCallEngine } from '@/features/calls/call-engine'
import { isWindowFocused, notify } from '@/lib/notify'
import { realtime } from '@/realtime/socket'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

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
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.token)
  const sessionId = useAuthStore((state) => state.sessionId)
  const deviceId = useAuthStore((state) => state.deviceId)
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)

  useEffect(() => {
    if (!token) {
      realtime.disconnect()
      return
    }
    realtime.connect({ token, sessionId, deviceId })
    return () => realtime.disconnect()
  }, [token, sessionId, deviceId])

  // Call signalling is its own concern, but shares this socket and lifetime.
  useEffect(() => {
    if (!token || currentUserId < 0) return
    return initCallEngine(currentUserId)
  }, [token, currentUserId])

  useEffect(() => {
    if (!token) return
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

    unsubscribers.push(realtime.on('message_queued', (raw) => ingest(raw)))
    unsubscribers.push(realtime.on('message_persisted', (raw) => ingest(raw, { announce: true })))
    unsubscribers.push(realtime.on('message_persisted_ack', (raw) => ingest(raw)))
    unsubscribers.push(realtime.on('message_edited', (raw) => ingest(raw)))

    unsubscribers.push(
      realtime.on('message_deleted', (raw) => {
        const message = toMessage(raw)
        upsertMessage(queryClient, { ...message, isDeleted: true, body: '' })
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
        // Only the client id is known here, so match the optimistic row by it.
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

    const applyDelivery = (payload: {
      conversation_id: number
      message_id: number
      delivery_state: 'queued' | 'persisted' | 'delivered' | 'read' | 'failed'
    }) => {
      const incoming =
        payload.delivery_state === 'queued'
          ? 'sending'
          : payload.delivery_state === 'persisted'
            ? 'sent'
            : payload.delivery_state
      queryClient.setQueryData(
        queryKeys.messages(payload.conversation_id),
        (previous: ReturnType<typeof toMessage>[] | undefined) =>
          previous?.map((message) =>
            message.id === payload.message_id
              ? { ...message, delivery: advanceDelivery(message.delivery, incoming) }
              : message,
          ),
      )
    }

    unsubscribers.push(realtime.on('message_delivery_state', applyDelivery))
    unsubscribers.push(
      realtime.on('message_delivered', (payload) =>
        applyDelivery({ ...payload, delivery_state: 'delivered' }),
      ),
    )
    unsubscribers.push(
      realtime.on('message_read', (payload) =>
        applyDelivery({ ...payload, delivery_state: 'read' }),
      ),
    )

    unsubscribers.push(
      realtime.on('missed_messages', (payload) => {
        for (const raw of payload.messages ?? []) upsertMessage(queryClient, toMessage(raw))
      }),
    )

    // ---- membership --------------------------------------------------------
    unsubscribers.push(
      realtime.on('conversation_members_added', () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      }),
    )
    unsubscribers.push(
      realtime.on('conversation_member_removed', () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      }),
    )
    unsubscribers.push(
      realtime.on('conversation_removed', (payload) => {
        queryClient.removeQueries({ queryKey: queryKeys.messages(payload.conversation_id) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
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

    // A message that arrived while the transcript was closed is only in the
    // cache; refetching on reconnect fills anything the socket missed.
    unsubscribers.push(
      realtime.onStatus((status) => {
        if (status === 'connected') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
          const active = chat().activeConversationId
          if (active !== null) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.messages(active) })
          }
        }
      }),
    )

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [token, queryClient, currentUserId])

  return <>{children}</>
}
