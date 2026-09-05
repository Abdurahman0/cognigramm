import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatStore } from '@/stores/chat'

describe('chat store', () => {
  beforeEach(() => {
    useChatStore.setState({
      typingByConversation: {},
      unreadByConversation: {},
      draftByConversation: {},
      onlineUserIds: [],
    })
  })

  it('expires a typing indicator when no stop frame arrives', () => {
    vi.useFakeTimers()
    const { setTyping } = useChatStore.getState()

    setTyping(10, 7, true)
    expect(useChatStore.getState().typingByConversation[10]).toEqual([7])

    vi.advanceTimersByTime(7_000)
    expect(useChatStore.getState().typingByConversation[10]).toEqual([])

    vi.useRealTimers()
  })

  it('does not list the same typist twice', () => {
    const { setTyping } = useChatStore.getState()
    setTyping(10, 7, true)
    setTyping(10, 7, true)
    expect(useChatStore.getState().typingByConversation[10]).toEqual([7])
  })

  it('drops a draft once it is empty rather than storing whitespace', () => {
    const { setDraft } = useChatStore.getState()
    setDraft(10, 'hello')
    expect(useChatStore.getState().draftByConversation[10]).toBe('hello')

    setDraft(10, '   ')
    expect(useChatStore.getState().draftByConversation[10]).toBeUndefined()
  })

  it('counts unread per conversation and clears on open', () => {
    const { bumpUnread, clearUnread } = useChatStore.getState()
    bumpUnread(10)
    bumpUnread(10)
    bumpUnread(11)
    expect(useChatStore.getState().unreadByConversation).toEqual({ 10: 2, 11: 1 })

    clearUnread(10)
    expect(useChatStore.getState().unreadByConversation).toEqual({ 11: 1 })
  })

  it('keeps the online set free of duplicates', () => {
    const { setUserOnline } = useChatStore.getState()
    setUserOnline(7, true)
    setUserOnline(7, true)
    expect(useChatStore.getState().onlineUserIds).toEqual([7])

    setUserOnline(7, false)
    expect(useChatStore.getState().onlineUserIds).toEqual([])
  })
})
