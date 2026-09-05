import type { QueryClient } from '@tanstack/react-query'

import { toMessage } from '@/api/adapters'
import { conversationsApi } from '@/api/endpoints'
import { upsertMessage } from '@/api/message-cache'
import { queryKeys } from '@/api/query-keys'
import type { Message } from '@/types'

/**
 * Recovery from the per-conversation change feed.
 *
 * Redis-delivered socket events can be missed — a dropped connection, a worker
 * restart, a laptop lid. `GET /conversations/{id}/changes?after_id=` replays
 * creates, edits, deletes and pin changes since a cursor the client stores.
 * Each entry carries the message's *current* state, so entries apply as
 * upserts and their order does not matter.
 */

const CURSOR_STORAGE_KEY = 'qq.change-cursors'

/** Server caps `limit` at 200; 100 is its default page size. */
const PAGE_SIZE = 100

/** A runaway loop here would hammer the API; a conversation is never this far behind. */
const MAX_PAGES = 20

type CursorMap = Record<number, number>

const readCursors = (): CursorMap => {
  try {
    const raw = localStorage.getItem(CURSOR_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CursorMap) : {}
  } catch {
    return {}
  }
}

const writeCursors = (cursors: CursorMap): void => {
  try {
    localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(cursors))
  } catch {
    // Storage unavailable: recovery still works, it just replays more.
  }
}

export const getCursor = (conversationId: number): number => readCursors()[conversationId] ?? 0

export const setCursor = (conversationId: number, cursor: number): void => {
  const cursors = readCursors()
  if ((cursors[conversationId] ?? 0) >= cursor) return
  cursors[conversationId] = cursor
  writeCursors(cursors)
}

export const forgetCursor = (conversationId: number): void => {
  const cursors = readCursors()
  if (!(conversationId in cursors)) return
  delete cursors[conversationId]
  writeCursors(cursors)
}

/**
 * Whether a replayed message belongs in the transcript the user can see.
 *
 * On a first sync the feed may reach back further than the loaded window, and
 * splicing a message from months ago above the newest page would read as a
 * gap rather than history. So an entry is applied when the client already
 * knows the message, or when it is at least as new as the oldest message on
 * screen. Anything older is left to normal history paging.
 */
const isInScope = (incoming: Message, loaded: Message[] | undefined): boolean => {
  if (!loaded || loaded.length === 0) return true
  if (loaded.some((message) => message.id === incoming.id)) return true
  const oldest = loaded[0]
  return !oldest || incoming.createdAt >= oldest.createdAt
}

/**
 * Applies every pending change for one conversation. Returns the number of
 * messages actually written, so a caller can decide whether to re-render.
 */
export async function recoverConversation(
  queryClient: QueryClient,
  conversationId: number,
): Promise<number> {
  let cursor = getCursor(conversationId)
  let applied = 0

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await conversationsApi.changes(conversationId, cursor, PAGE_SIZE)
    const items = Array.isArray(response?.items) ? response.items : []

    if (items.length > 0) {
      const loaded = queryClient.getQueryData<Message[]>(queryKeys.messages(conversationId))
      let touchedPins = false

      for (const item of items) {
        if (!item?.message) continue
        const message = toMessage(item.message)
        if (!isInScope(message, loaded)) continue
        upsertMessage(queryClient, message)
        applied += 1
        if (item.event === 'message_pinned' || item.event === 'message_unpinned') {
          touchedPins = true
        }
      }

      if (touchedPins) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.pinned(conversationId) })
      }
    }

    // Persist only after the whole page is applied: a crash mid-page must
    // replay it rather than skip it.
    if (typeof response?.next_cursor === 'number' && response.next_cursor > cursor) {
      cursor = response.next_cursor
      setCursor(conversationId, cursor)
    }

    if (!response?.has_more) break
  }

  return applied
}

/** Recovers several conversations without stampeding the API. */
export async function recoverConversations(
  queryClient: QueryClient,
  conversationIds: number[],
): Promise<void> {
  for (const conversationId of conversationIds) {
    try {
      await recoverConversation(queryClient, conversationId)
    } catch {
      // One conversation failing must not abandon the rest.
    }
  }
}
