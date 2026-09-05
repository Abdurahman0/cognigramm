import { describe, expect, it } from 'vitest'

import { formatBytes, toConversation, toMessage, toUser } from '@/api/adapters'
import type { ApiConversation, ApiMessage, ApiUser } from '@/api/types'

const apiUser: ApiUser = {
  id: 7,
  username: 'ann',
  email: 'ann@example.com',
  full_name: null,
  avatar_url: null,
  role_id: null,
  department_id: null,
  title: null,
  about: null,
  timezone: '',
  phone: null,
  handle: null,
  office_location: null,
  manager_id: null,
  last_seen_at: null,
  status: 'available',
  created_at: '2026-03-01T00:00:00Z',
}

describe('toUser', () => {
  it('falls back to the username when there is no full name', () => {
    expect(toUser(apiUser).fullName).toBe('ann')
  })

  it('defaults an empty timezone to UTC', () => {
    expect(toUser(apiUser).timezone).toBe('UTC')
  })
})

describe('toConversation', () => {
  const direct: ApiConversation = {
    id: 10,
    type: 'direct',
    title: null,
    created_at: '2026-03-01T00:00:00Z',
    participants: [
      { user_id: 1, username: 'me', role: 'member', joined_at: '2026-03-01T00:00:00Z' },
      { user_id: 7, username: 'ann', role: 'member', joined_at: '2026-03-01T00:00:00Z' },
    ],
  }

  it('titles a direct chat after the other participant', () => {
    const conversation = toConversation(direct, 1)
    expect(conversation.title).toBe('ann')
    expect(conversation.peerId).toBe(7)
  })

  it('leaves a group without a peer', () => {
    const group = toConversation({ ...direct, type: 'group', title: 'Design' }, 1)
    expect(group.title).toBe('Design')
    expect(group.peerId).toBeNull()
  })
})

describe('toMessage', () => {
  const base: ApiMessage = {
    id: 5,
    conversation_id: 10,
    sender_id: 7,
    sender: { id: 7, username: 'ann' },
    client_message_id: 'msg_a',
    content: 'hi',
    message_type: 'text',
    status: 'sent',
    delivery_state: 'read',
    attachments: [],
    queued_at: null,
    persisted_at: null,
    delivered_at: null,
    read_at: null,
    delivery_updated_at: null,
    created_at: '2026-03-18T12:00:00Z',
    edited_at: null,
    deleted_at: null,
  }

  it('maps the backend delivery state onto the tick states', () => {
    expect(toMessage(base).delivery).toBe('read')
    expect(toMessage({ ...base, delivery_state: 'queued' }).delivery).toBe('sending')
    expect(toMessage({ ...base, delivery_state: 'persisted' }).delivery).toBe('sent')
  })

  it('blanks the body of a deleted message', () => {
    const deleted = toMessage({ ...base, deleted_at: '2026-03-18T12:05:00Z' })
    expect(deleted.isDeleted).toBe(true)
    expect(deleted.body).toBe('')
  })

  it('treats a failed status as failed regardless of delivery state', () => {
    expect(toMessage({ ...base, status: 'failed' }).delivery).toBe('failed')
  })
})

describe('formatBytes', () => {
  it('scales to the right unit', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('has something to show for a missing size', () => {
    expect(formatBytes(null)).toBe('—')
  })
})
