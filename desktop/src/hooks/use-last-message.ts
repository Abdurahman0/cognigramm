import { useQuery } from '@tanstack/react-query'

import { toMessage } from '@/api/adapters'
import { messagesApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import type { Message } from '@/types'

/**
 * The preview line in the conversation list.
 *
 * Fetched once per conversation and then kept current by the realtime bridge,
 * which writes every incoming message straight into this key. That is why the
 * query is `staleTime: Infinity` — refetching would only duplicate work the
 * socket has already done.
 */
export function useLastMessage(conversationId: number) {
  return useQuery<Message | null>({
    queryKey: queryKeys.latestMessage(conversationId),
    queryFn: async () => {
      const row = await messagesApi.latest(conversationId)
      return row ? toMessage(row) : null
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

/** One-line preview for a message of any kind. */
export const previewOf = (message: Message | null | undefined): string => {
  if (!message) return 'No messages yet'
  if (message.isDeleted) return 'Message deleted'
  if (message.body.trim()) return message.body.replace(/\s+/g, ' ').trim()
  switch (message.kind) {
    case 'image':
      return '📷 Photo'
    case 'voice':
      return '🎤 Voice message'
    case 'video_note':
      return '📹 Video message'
    case 'file':
      return `📎 ${message.attachments[0]?.name ?? 'File'}`
    case 'system':
      return 'System message'
    default:
      return ''
  }
}
