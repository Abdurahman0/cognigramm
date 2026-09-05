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
    // Defensive on `createdAt`: a malformed payload should misplace one row,
    // never throw inside a sort comparator and take the window down with it.
    const byTime = (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
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

/**
 * Adds rows from an older snapshot that the newer one does not contain.
 *
 * This is `structuralSharing` for a transcript, and the direction matters: a
 * fetch returns the newest page, which is missing the older pages already on
 * screen and any optimistic row still in flight — but the rows it *does*
 * contain are fresher than the cached ones. Merging the other way round is a
 * real bug: it puts an optimistic "sending" row back over the persisted
 * message that just replaced it, and the tick marks never advance.
 */
export const mergeMissing = (previous: Message[], next: Message[]): Message[] => {
  if (previous.length === 0) return next

  const known = new Set<string>()
  for (const message of next) {
    if (message.id > 0) known.add(`id:${message.id}`)
    if (message.clientMessageId) known.add(`cid:${message.clientMessageId}`)
  }

  const missing = previous.filter(
    (message) =>
      !known.has(`id:${message.id}`) &&
      !(message.clientMessageId && known.has(`cid:${message.clientMessageId}`)),
  )

  return missing.length === 0 ? next : sortMessages([...next, ...missing])
}

export const upsertMessage = (queryClient: QueryClient, message: Message): void => {
  // Guard the cache at its only entrance. Some socket events carry an
  // acknowledgement rather than a message, and writing one of those into a
  // transcript would corrupt every later merge.
  if (!message?.createdAt || !Number.isFinite(message.conversationId)) return
  queryClient.setQueryData<Message[]>(queryKeys.messages(message.conversationId), (previous) =>
    mergeMessage(previous ?? [], message),
  )
}

/**
 * Applies a delivery update when the event does not say which conversation the
 * message belongs to — which is the case for `message_delivery_state`. Scans
 * the loaded transcripts, of which there are only ever a handful.
 */
export const applyDeliveryById = (
  queryClient: QueryClient,
  messageId: number,
  incoming: DeliveryState,
): void => {
  const caches = queryClient.getQueriesData<Message[]>({ queryKey: ['messages'] })
  for (const [key, messages] of caches) {
    // Skip the sibling keys — pinned lists, search results, latest-message.
    if (key.length !== 2 || !Array.isArray(messages)) continue
    if (!messages.some((message) => message.id === messageId)) continue
    queryClient.setQueryData<Message[]>(key, (previous) =>
      previous?.map((message) =>
        message.id === messageId
          ? { ...message, delivery: advanceDelivery(message.delivery, incoming) }
          : message,
      ),
    )
    return
  }
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
