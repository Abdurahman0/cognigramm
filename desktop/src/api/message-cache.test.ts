import { describe, expect, it } from 'vitest'

import { QueryClient } from '@tanstack/react-query'

import {
  advanceDelivery,
  applyDeliveryById,
  mergeMessage,
  mergeMissing,
  sortMessages,
  upsertMessage,
} from '@/api/message-cache'
import { queryKeys } from '@/api/query-keys'
import type { Message } from '@/types'

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 1,
  clientMessageId: 'msg_a',
  conversationId: 10,
  senderId: 1,
  senderName: 'ann',
  body: 'hello',
  kind: 'text',
  delivery: 'sent',
  attachments: [],
  replyToMessageId: null,
  forwardedFromMessageId: null,
  isPinned: false,
  isDeleted: false,
  createdAt: '2026-03-18T12:00:00.000Z',
  editedAt: null,
  ...overrides,
})

describe('mergeMessage', () => {
  it('replaces an optimistic row with the server row of the same client id', () => {
    const optimistic = message({ id: -1700000, delivery: 'sending', pending: true })
    const persisted = message({ id: 42, delivery: 'sent' })

    const result = mergeMessage([optimistic], persisted)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(42)
    expect(result[0]?.pending).toBe(false)
  })

  it('does not duplicate a message that arrives twice', () => {
    const persisted = message({ id: 42 })
    expect(mergeMessage([persisted], persisted)).toHaveLength(1)
  })

  it('appends a genuinely new message', () => {
    const first = message({ id: 1, clientMessageId: 'msg_a' })
    const second = message({
      id: 2,
      clientMessageId: 'msg_b',
      createdAt: '2026-03-18T12:01:00.000Z',
    })

    expect(mergeMessage([first], second).map((row) => row.id)).toEqual([1, 2])
  })

  it('keeps the list in chronological order regardless of arrival order', () => {
    const later = message({ id: 2, clientMessageId: 'b', createdAt: '2026-03-18T12:05:00.000Z' })
    const earlier = message({ id: 1, clientMessageId: 'a', createdAt: '2026-03-18T12:00:00.000Z' })

    expect(sortMessages([later, earlier]).map((row) => row.id)).toEqual([1, 2])
  })
})

describe('advanceDelivery', () => {
  it('moves forward through the states', () => {
    expect(advanceDelivery('sending', 'sent')).toBe('sent')
    expect(advanceDelivery('sent', 'delivered')).toBe('delivered')
    expect(advanceDelivery('delivered', 'read')).toBe('read')
  })

  it('ignores a late frame that would walk the ticks backwards', () => {
    expect(advanceDelivery('read', 'delivered')).toBe('read')
    expect(advanceDelivery('delivered', 'sent')).toBe('delivered')
  })

  it('always accepts a failure', () => {
    expect(advanceDelivery('read', 'failed')).toBe('failed')
  })
})

describe('upsertMessage', () => {
  it('refuses payloads that are acknowledgements rather than messages', () => {
    const client = new QueryClient()
    // `message_queued` carries only a client id; writing it into a transcript
    // would corrupt every later merge.
    upsertMessage(client, { conversationId: 10, clientMessageId: 'c1' } as unknown as Message)
    expect(client.getQueryData(queryKeys.messages(10))).toBeUndefined()
  })
})

describe('applyDeliveryById', () => {
  it('finds the conversation itself when the event omits it', () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.messages(10), [message({ id: 42, delivery: 'sent' })])
    client.setQueryData(queryKeys.messages(11), [message({ id: 99, delivery: 'sent' })])

    applyDeliveryById(client, 42, 'read')

    expect(client.getQueryData<Message[]>(queryKeys.messages(10))?.[0]?.delivery).toBe('read')
    expect(client.getQueryData<Message[]>(queryKeys.messages(11))?.[0]?.delivery).toBe('sent')
  })

  it('leaves sibling caches such as pinned lists alone', () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.pinned(10), [message({ id: 42, delivery: 'sent' })])

    applyDeliveryById(client, 42, 'read')

    expect(client.getQueryData<Message[]>(queryKeys.pinned(10))?.[0]?.delivery).toBe('sent')
  })

  it('still refuses to move a tick backwards', () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.messages(10), [message({ id: 42, delivery: 'read' })])

    applyDeliveryById(client, 42, 'delivered')

    expect(client.getQueryData<Message[]>(queryKeys.messages(10))?.[0]?.delivery).toBe('read')
  })
})

describe('mergeMissing', () => {
  it('keeps the fetched row, not the optimistic one it replaced', () => {
    // The regression this exists for: merging the cached copy over the fetched
    // one put a "sending" row back on top of the persisted message, so its
    // tick never advanced past the clock.
    const optimistic = message({ id: -1, delivery: 'sending', pending: true })
    const persisted = message({ id: 42, delivery: 'sent' })

    const result = mergeMissing([optimistic], [persisted])

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(42)
    expect(result[0]?.delivery).toBe('sent')
  })

  it('keeps older pages the newest page does not include', () => {
    const older = message({
      id: 1,
      clientMessageId: 'older',
      createdAt: '2026-03-18T10:00:00.000Z',
    })
    const newest = message({ id: 90, clientMessageId: 'newest' })

    const result = mergeMissing([older], [newest])

    expect(result.map((row) => row.id)).toEqual([1, 90])
  })

  it('keeps an in-flight message the server has not echoed yet', () => {
    const inFlight = message({ id: -7, clientMessageId: 'pending-1', pending: true })
    const unrelated = message({ id: 90, clientMessageId: 'other' })

    const result = mergeMissing([inFlight], [unrelated])

    expect(result.some((row) => row.clientMessageId === 'pending-1')).toBe(true)
  })
})
