import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/api/query-keys'
import type { ApiChangesPage, ApiMessage } from '@/api/types'
import type { Message } from '@/types'

const changesMock = vi.fn()

vi.mock('@/api/endpoints', () => ({
  conversationsApi: { changes: (...args: unknown[]) => changesMock(...args) },
}))

const { forgetCursor, getCursor, recoverConversation } = await import('@/api/change-feed')

const apiMessage = (id: number, overrides: Partial<ApiMessage> = {}): ApiMessage => ({
  id,
  conversation_id: 10,
  sender_id: 2,
  sender: { id: 2, username: 'ann' },
  client_message_id: `c${id}`,
  content: `message ${id}`,
  message_type: 'text',
  status: 'sent',
  delivery_state: 'persisted',
  attachments: [],
  queued_at: null,
  persisted_at: null,
  delivered_at: null,
  read_at: null,
  delivery_updated_at: null,
  created_at: '2026-09-05T12:00:00Z',
  edited_at: null,
  deleted_at: null,
  ...overrides,
})

const page = (items: ApiChangesPage['items'], next: number, more = false): ApiChangesPage => ({
  items,
  next_cursor: next,
  has_more: more,
})

const seed = (client: QueryClient, messages: Message[]) =>
  client.setQueryData(queryKeys.messages(10), messages)

const cached = (client: QueryClient): Message[] =>
  client.getQueryData<Message[]>(queryKeys.messages(10)) ?? []

const loaded = (id: number, createdAt: string): Message => ({
  id,
  clientMessageId: `c${id}`,
  conversationId: 10,
  senderId: 2,
  senderName: 'ann',
  body: `message ${id}`,
  kind: 'text',
  delivery: 'sent',
  attachments: [],
  replyToMessageId: null,
  forwardedFromMessageId: null,
  isPinned: false,
  isDeleted: false,
  createdAt,
  editedAt: null,
})

describe('recoverConversation', () => {
  let client: QueryClient

  beforeEach(() => {
    localStorage.clear()
    changesMock.mockReset()
    client = new QueryClient()
    forgetCursor(10)
  })

  it('applies an edit that was missed while the socket was down', async () => {
    seed(client, [loaded(5, '2026-09-05T12:00:00Z')])
    changesMock.mockResolvedValueOnce(
      page(
        [{ cursor: 7, event: 'message_edited', message: apiMessage(5, { content: 'edited' }) }],
        7,
      ),
    )

    await recoverConversation(client, 10)

    expect(cached(client)[0]?.body).toBe('edited')
    expect(getCursor(10)).toBe(7)
  })

  it('resumes from the stored cursor instead of replaying everything', async () => {
    seed(client, [loaded(5, '2026-09-05T12:00:00Z')])
    changesMock.mockResolvedValueOnce(page([], 7))
    await recoverConversation(client, 10)

    changesMock.mockResolvedValueOnce(page([], 7))
    await recoverConversation(client, 10)

    expect(changesMock).toHaveBeenNthCalledWith(2, 10, 7, 100)
  })

  it('follows has_more until the feed is exhausted', async () => {
    seed(client, [loaded(5, '2026-09-05T12:00:00Z')])
    changesMock
      .mockResolvedValueOnce(
        page([{ cursor: 8, event: 'message_created', message: apiMessage(6) }], 8, true),
      )
      .mockResolvedValueOnce(
        page([{ cursor: 9, event: 'message_created', message: apiMessage(7) }], 9, false),
      )

    await recoverConversation(client, 10)

    expect(changesMock).toHaveBeenCalledTimes(2)
    expect(cached(client).map((message) => message.id)).toEqual([5, 6, 7])
    expect(getCursor(10)).toBe(9)
  })

  it('turns a delete into a tombstone rather than dropping the row', async () => {
    seed(client, [loaded(5, '2026-09-05T12:00:00Z')])
    changesMock.mockResolvedValueOnce(
      page(
        [
          {
            cursor: 8,
            event: 'message_deleted',
            message: apiMessage(5, { deleted_at: '2026-09-05T13:00:00Z', content: null }),
          },
        ],
        8,
      ),
    )

    await recoverConversation(client, 10)

    expect(cached(client)[0]?.isDeleted).toBe(true)
    expect(cached(client)[0]?.body).toBe('')
  })

  it('ignores replayed messages older than the loaded window', async () => {
    // The feed can reach back further than the transcript on screen; splicing
    // a months-old message above the newest page would look like a gap.
    seed(client, [loaded(50, '2026-09-05T12:00:00Z')])
    changesMock.mockResolvedValueOnce(
      page(
        [
          {
            cursor: 8,
            event: 'message_created',
            message: apiMessage(3, { created_at: '2026-01-01T00:00:00Z' }),
          },
        ],
        8,
      ),
    )

    await recoverConversation(client, 10)

    expect(cached(client).map((message) => message.id)).toEqual([50])
    // The cursor still advances: those entries are accounted for.
    expect(getCursor(10)).toBe(8)
  })

  it('accepts a message that arrived while the conversation was closed', async () => {
    seed(client, [loaded(50, '2026-09-05T12:00:00Z')])
    changesMock.mockResolvedValueOnce(
      page(
        [
          {
            cursor: 8,
            event: 'message_created',
            message: apiMessage(51, { created_at: '2026-09-05T14:00:00Z' }),
          },
        ],
        8,
      ),
    )

    await recoverConversation(client, 10)

    expect(cached(client).map((message) => message.id)).toEqual([50, 51])
  })
})
