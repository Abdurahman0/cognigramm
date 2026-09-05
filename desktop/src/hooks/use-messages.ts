import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { toMessage } from '@/api/adapters'
import { filesApi, messagesApi } from '@/api/endpoints'
import { mergeMessage, sortMessages, upsertMessage } from '@/api/message-cache'
import { queryKeys } from '@/api/query-keys'
import type { ApiAttachmentIn, ApiMessageType } from '@/api/types'
import { createClientMessageId } from '@/lib/utils'
import { realtime } from '@/realtime/socket'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/components/ui/toast'
import type { Message } from '@/types'

const PAGE_SIZE = 60

/**
 * How many messages the transcript currently asks for, per conversation.
 *
 * Kept outside React so "load earlier" can grow the window without changing
 * the query key — the key has to stay stable, because the socket writes into
 * it from outside this hook.
 */
const pageSizeByConversation = new Map<number, number>()

export function useMessages(conversationId: number | null) {
  return useQuery({
    queryKey: conversationId ? queryKeys.messages(conversationId) : ['messages', 'none'],
    enabled: conversationId !== null,
    queryFn: async () => {
      const id = conversationId as number
      const limit = pageSizeByConversation.get(id) ?? PAGE_SIZE
      const rows = await messagesApi.list(id, { limit })
      return sortMessages((Array.isArray(rows) ? rows : []).map(toMessage))
    },
    // The socket is the live path. A refetch only fills gaps after a
    // reconnect, so the cached transcript can stay fresh for a while.
    staleTime: 30_000,
    // A refetch must not drop optimistic rows the server has not echoed yet.
    structuralSharing: (previous, next) => {
      const pending = ((previous as Message[] | undefined) ?? []).filter(
        (message) => message.pending,
      )
      if (pending.length === 0) return next
      return pending.reduce<Message[]>(
        (list, message) => mergeMessage(list, message),
        next as Message[],
      )
    },
  })
}

/**
 * Grows the window by one page and refetches.
 *
 * Returns whether more may exist: the server has no total, so a page that came
 * back short of what was asked for is the signal that the top was reached.
 */
export function useLoadOlderMessages(conversationId: number | null) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const loadOlder = useCallback(async () => {
    if (conversationId === null) return
    const current = pageSizeByConversation.get(conversationId) ?? PAGE_SIZE
    const before =
      queryClient.getQueryData<Message[]>(queryKeys.messages(conversationId))?.length ?? 0
    if (before < current) return

    setIsLoading(true)
    pageSizeByConversation.set(conversationId, current + PAGE_SIZE)
    try {
      await queryClient.refetchQueries({ queryKey: queryKeys.messages(conversationId) })
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, queryClient])

  const loaded = queryClient.getQueryData<Message[]>(
    conversationId !== null ? queryKeys.messages(conversationId) : ['messages', 'none'],
  )?.length
  const requested =
    conversationId !== null ? (pageSizeByConversation.get(conversationId) ?? PAGE_SIZE) : PAGE_SIZE

  return { loadOlder, isLoading, hasMore: (loaded ?? 0) >= requested }
}

export function usePinnedMessages(conversationId: number | null) {
  return useQuery({
    queryKey: conversationId ? queryKeys.pinned(conversationId) : ['pinned', 'none'],
    enabled: conversationId !== null,
    queryFn: async () => {
      const rows = await messagesApi.pinned(conversationId as number)
      return (Array.isArray(rows) ? rows : []).map(toMessage)
    },
    staleTime: 60_000,
  })
}

export function useMessageSearch(conversationId: number | null, term: string) {
  return useQuery({
    queryKey: conversationId ? queryKeys.messageSearch(conversationId, term) : ['search', 'none'],
    enabled: conversationId !== null && term.trim().length >= 2,
    queryFn: async () => {
      const hits = await messagesApi.search(conversationId as number, term.trim())
      return (Array.isArray(hits) ? hits : []).map((hit) => toMessage(hit.message))
    },
  })
}

interface SendInput {
  content: string
  kind?: ApiMessageType
  attachments?: ApiAttachmentIn[]
  replyToMessageId?: number | null
}

/**
 * Sending goes over the socket, not REST: the server assigns the id and echoes
 * `message_persisted`, which is also what every other member receives. The
 * optimistic row below is what makes the composer feel instant; the realtime
 * bridge replaces it when the echo lands, matching on `client_message_id`.
 */
export function useSendMessage(conversationId: number | null) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)

  return useCallback(
    ({ content, kind = 'text', attachments = [], replyToMessageId = null }: SendInput) => {
      if (conversationId === null || !currentUser) return null
      const trimmed = content.trim()
      if (!trimmed && attachments.length === 0) return null

      const clientMessageId = createClientMessageId()
      const optimistic: Message = {
        id: -Date.now(),
        clientMessageId,
        conversationId,
        senderId: currentUser.id,
        senderName: currentUser.username,
        body: trimmed,
        kind,
        delivery: 'sending',
        attachments: attachments.map((attachment, index) => ({
          id: -index - 1,
          name: attachment.original_name,
          mimeType: attachment.mime_type,
          sizeBytes: attachment.size_bytes,
          sizeLabel: '',
          url: attachment.public_url ?? null,
          bucket: attachment.bucket,
          objectKey: attachment.object_key,
          metadata: attachment.metadata_json ?? null,
        })),
        replyToMessageId,
        isPinned: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        editedAt: null,
        pending: true,
      }

      upsertMessage(queryClient, optimistic)

      realtime.send('send_message', {
        conversation_id: conversationId,
        content: trimmed || null,
        type: kind,
        client_message_id: clientMessageId,
        reply_to_message_id: replyToMessageId,
        forwarded_from_message_id: null,
        attachments,
      })

      return clientMessageId
    },
    [conversationId, currentUser, queryClient],
  )
}

/** Uploads a file, then sends the message that carries it. */
export function useSendAttachment(conversationId: number | null) {
  const send = useSendMessage(conversationId)

  return useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await filesApi.uploadLocal(file)
      const kind: ApiMessageType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('audio/')
          ? 'voice'
          : 'file'

      send({
        content: '',
        kind,
        attachments: [
          {
            bucket: uploaded.bucket,
            object_key: uploaded.object_key,
            original_name: uploaded.original_name,
            mime_type: uploaded.mime_type,
            size_bytes: uploaded.size_bytes,
            public_url: uploaded.public_url,
            metadata_json: null,
          },
        ],
      })
      return uploaded
    },
    onError: (error: Error) => toast.error('Upload failed', error.message),
  })
}

export function useEditMessage() {
  return useCallback((messageId: number, content: string) => {
    realtime.send('edit_message', { message_id: messageId, content })
  }, [])
}

export function useDeleteMessage() {
  return useCallback((messageId: number) => {
    realtime.send('delete_message', { message_id: messageId })
  }, [])
}

export function useTogglePin() {
  return useCallback((messageId: number, isPinned: boolean) => {
    realtime.send(isPinned ? 'unpin_message' : 'pin_message', { message_id: messageId })
  }, [])
}

/** Read receipts go over the socket; the REST route exists but is a fallback. */
export function useMarkRead() {
  return useCallback((messageId: number) => {
    if (messageId <= 0) return
    realtime.send('read_receipt', { message_id: messageId })
  }, [])
}
