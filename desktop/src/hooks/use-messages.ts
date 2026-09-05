import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { formatBytes, toMessage } from '@/api/adapters'
import { filesApi, MAX_UPLOAD_BYTES, messagesApi } from '@/api/endpoints'
import { rememberSignedUrl } from '@/api/media-urls'
import { mergeMessage, mergeMissing, sortMessages, upsertMessage } from '@/api/message-cache'
import { queryKeys } from '@/api/query-keys'
import type { ApiAttachmentIn, ApiMessageType } from '@/api/types'
import { createClientMessageId } from '@/lib/utils'
import { realtime } from '@/realtime/socket'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/components/ui/toast'
import type { Message } from '@/types'

/** The server caps `limit` at 100; older pages come from `offset`, not a bigger page. */
const PAGE_SIZE = 50

/**
 * Conversations whose history has been read to the beginning.
 *
 * Kept outside React so "load earlier" does not need its own query key — the
 * key has to stay stable, because the socket writes into it from outside.
 */
const exhausted = new Set<number>()

export function useMessages(conversationId: number | null) {
  return useQuery({
    queryKey: conversationId ? queryKeys.messages(conversationId) : ['messages', 'none'],
    enabled: conversationId !== null,
    queryFn: async () => {
      const id = conversationId as number
      // Always the newest page. Older ones are merged in by `loadOlder`, and
      // `structuralSharing` below keeps them across refetches.
      const rows = await messagesApi.list(id, { limit: PAGE_SIZE, offset: 0 })
      return sortMessages((Array.isArray(rows) ? rows : []).map(toMessage))
    },
    // The socket is the live path. A refetch only fills gaps after a
    // reconnect, so the cached transcript can stay fresh for a while.
    staleTime: 30_000,
    /**
     * A fetch returns the newest page, which is not a superset of what is on
     * screen: older pages already loaded, and optimistic rows the server has
     * not echoed yet, live only in the cache. Those are added back — but only
     * the ones the new data does not already describe. Merging the other way
     * round puts a "sending" row back over the message that just replaced it,
     * and the tick marks then never advance.
     */
    structuralSharing: (previous, next) =>
      mergeMissing((previous as Message[] | undefined) ?? [], next as Message[]),
  })
}

/**
 * Loads one page of older history and merges it into the transcript.
 *
 * Offset counts only messages the server has actually assigned an id, so an
 * optimistic row waiting for its echo cannot push the window past a real
 * message. New arrivals can still shift the offset under us — the contract
 * says as much — which is why every write goes through a merge that
 * de-duplicates by id.
 */
export function useLoadOlderMessages(conversationId: number | null) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    setHasMore(conversationId !== null && !exhausted.has(conversationId))
  }, [conversationId])

  const loadOlder = useCallback(async () => {
    if (conversationId === null || exhausted.has(conversationId)) return

    const key = queryKeys.messages(conversationId)
    const loaded = queryClient.getQueryData<Message[]>(key) ?? []
    const offset = loaded.filter((message) => message.id > 0).length
    if (offset === 0) return

    setIsLoading(true)
    try {
      const rows = await messagesApi.list(conversationId, { limit: PAGE_SIZE, offset })
      const older = (Array.isArray(rows) ? rows : []).map(toMessage)

      queryClient.setQueryData<Message[]>(key, (previous) =>
        older.reduce<Message[]>((list, message) => mergeMessage(list, message), previous ?? []),
      )

      // A short page is the only signal that the beginning has been reached.
      if (older.length < PAGE_SIZE) {
        exhausted.add(conversationId)
        setHasMore(false)
      }
    } catch {
      // Leave `hasMore` alone: a failed page is worth retrying on the next scroll.
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, queryClient])

  return { loadOlder, isLoading, hasMore }
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
  /**
   * Forwarding sends the source message id and no attachments: the server
   * copies the stored attachment metadata itself, after checking membership of
   * the conversation the message came from.
   */
  forwardedFromMessageId?: number | null
  /** Client-derived facts the backend never computes: duration, waveform, size. */
  metadata?: Record<string, unknown> | null
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
    ({
      content,
      kind = 'text',
      attachments = [],
      replyToMessageId = null,
      forwardedFromMessageId = null,
    }: SendInput) => {
      if (conversationId === null || !currentUser) return null
      const trimmed = content.trim()
      // A forward can be empty of both: the server fills it from the source.
      if (!trimmed && attachments.length === 0 && forwardedFromMessageId === null) return null

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
          sizeLabel: formatBytes(attachment.size_bytes),
          // The upload response's signed URL is cached by object key, so the
          // optimistic bubble can render the image before the echo returns.
          signedUrl: null,
          bucket: attachment.bucket,
          objectKey: attachment.object_key,
          metadata: attachment.metadata_json ?? null,
        })),
        replyToMessageId,
        forwardedFromMessageId,
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
        forwarded_from_message_id: forwardedFromMessageId,
        attachments,
      })

      return clientMessageId
    },
    [conversationId, currentUser, queryClient],
  )
}

/** Reads the pixel size of an image so the bubble can reserve its space. */
const imageDimensions = async (file: File): Promise<Record<string, number> | null> => {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}

interface SendFileInput {
  file: File
  /** Defaults to a guess from the MIME type. */
  kind?: ApiMessageType
  /** Duration, waveform, dimensions — whatever the client knows and the server does not. */
  metadata?: Record<string, unknown> | null
}

/**
 * Uploads a file to S3 through the backend, then sends the message carrying it.
 *
 * Only the stable identity of the object travels in the message. The signed
 * URL from the upload response is kept in the media cache instead, so the
 * bubble can render immediately without persisting a link that dies in
 * fifteen minutes.
 */
export function useSendFile(conversationId: number | null) {
  const send = useSendMessage(conversationId)

  return useMutation({
    mutationFn: async ({ file, kind, metadata }: SendFileInput) => {
      if (file.size === 0) throw new Error('That file is empty')
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(`That file is ${formatBytes(file.size)}; the limit is 100 MB`)
      }

      const dimensions = await imageDimensions(file)
      const uploaded = await filesApi.upload(file)
      rememberSignedUrl(uploaded.object_key, uploaded.public_url)

      const resolvedKind: ApiMessageType =
        kind ??
        (file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('audio/')
            ? 'voice'
            : 'file')

      send({
        content: '',
        kind: resolvedKind,
        attachments: [
          {
            bucket: uploaded.bucket,
            object_key: uploaded.object_key,
            original_name: uploaded.original_name,
            mime_type: uploaded.mime_type,
            size_bytes: uploaded.size_bytes,
            metadata_json: { ...(dimensions ?? {}), ...(metadata ?? {}) },
          },
        ],
      })
      return uploaded
    },
    onError: (error: Error) => toast.error('Upload failed', error.message),
  })
}

/** Forwards a message into another conversation. */
export function useForwardMessage() {
  const currentUser = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()

  return useCallback(
    (message: Message, targetConversationId: number) => {
      if (!currentUser) return
      const clientMessageId = createClientMessageId()

      // Attachments are deliberately empty: the server copies them from the
      // source message after checking membership of its conversation.
      realtime.send('send_message', {
        conversation_id: targetConversationId,
        content: message.body || null,
        type: message.kind,
        client_message_id: clientMessageId,
        reply_to_message_id: null,
        forwarded_from_message_id: message.id,
        attachments: [],
      })

      // The echo will fill in the real row; this keeps the target conversation
      // from looking untouched if the user switches to it immediately.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages(targetConversationId),
        refetchType: 'none',
      })
    },
    [currentUser, queryClient],
  )
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
