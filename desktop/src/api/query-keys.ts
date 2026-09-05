/**
 * One place for every cache key, so an invalidation can never miss a query by
 * spelling its key slightly differently at the call site.
 */
export const queryKeys = {
  me: ['me'] as const,
  users: (term: string) => ['users', term] as const,
  onlineUsers: ['presence', 'online'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: number) => ['conversations', id] as const,
  messages: (conversationId: number) => ['messages', conversationId] as const,
  latestMessage: (conversationId: number) => ['messages', conversationId, 'latest'] as const,
  pinned: (conversationId: number) => ['messages', conversationId, 'pinned'] as const,
  messageSearch: (conversationId: number, term: string) =>
    ['messages', conversationId, 'search', term] as const,
  callHistory: ['calls', 'history'] as const,
  health: ['system', 'health'] as const,
}
