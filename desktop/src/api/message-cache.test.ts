import { describe, expect, it } from 'vitest'

import { advanceDelivery, mergeMessage, sortMessages } from '@/api/message-cache'
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
