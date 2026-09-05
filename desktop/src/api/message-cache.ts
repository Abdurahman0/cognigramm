import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/query-keys'
import type { DeliveryState, Message } from '@/types'

/**
 * Every write to a transcript goes through here.
 *
 * The list is kept sorted and de-duplicated in one place because three sources
 * append to it — the REST fetch, the optimistic send, and the socket — and any
 * two of them can describe the same message.
 */

export const sortMessages = (messages: Message[]): Message[] =>
  [...messages].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt)
    if (byTime !== 0) return byTime
    return a.id - b.id
  })

const sameMessage = (a: Message, b: Message): boolean =>
  (a.id > 0 && a.id === b.id) ||
  (Boolean(a.clientMessageId) && a.clientMessageId === b.clientMessageId)

/** Insert or replace, matching an optimistic row by its client id first. */
export const mergeMessage = (list: Message[], incoming: Message): Message[] => {
  const index = list.findIndex((existing) => sameMessage(existing, incoming))
  if (index === -1) return sortMessages([...list, incoming])

  const previous = list[index]
  const next = [...list]
  next[index] = {
    ...previous,
    ...incoming,
    // A server row never carries the optimistic flags, and spreading it must
    // not resurrect them from the row being replaced.
    pending: incoming.pending ?? false,
    error: incoming.error,
  }
  return sortMessages(next)
}

export const upsertMessage = (queryClient: QueryClient, message: Message): void => {
  queryClient.setQueryData<Message[]>(queryKeys.messages(message.conversationId), (previous) =>
    mergeMessage(previous ?? [], message),
  )
}

export const patchMessage = (
  queryClient: QueryClient,
  conversationId: number,
  match: (message: Message) => boolean,
  patch: Partial<Message>,
): void => {
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), (previous) => {
    if (!previous) return previous
    let changed = false
    const next = previous.map((message) => {
      if (!match(message)) return message
      changed = true
      return { ...message, ...patch }
    })
    return changed ? next : previous
  })
}

/**
 * Delivery only ever moves forward. Without this guard an out-of-order
 * `delivered` frame arriving after `read` would walk the tick marks backwards.
 */
const DELIVERY_RANK: Record<DeliveryState, number> = {
  failed: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
}

export const advanceDelivery = (current: DeliveryState, incoming: DeliveryState): DeliveryState => {
  if (incoming === 'failed') return 'failed'
  return DELIVERY_RANK[incoming] > DELIVERY_RANK[current] ? incoming : current
}

export const removeMessage = (
  queryClient: QueryClient,
  conversationId: number,
  messageId: number,
): void => {
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), (previous) =>
    previous?.filter((message) => message.id !== messageId),
  )
}
