export const queryKeys = {
  me: ["me"] as const,
  conversations: ["conversations"] as const,
  conversation: (id: number) => ["conversations", id] as const,
  messages: (conversationId: number) => ["messages", conversationId] as const,
  messageDelivery: (messageId: number) => ["messageDelivery", messageId] as const,
  searchMessages: (conversationId: number, query: string) => ["searchMessages", conversationId, query] as const,
  searchUsers: (query: string) => ["searchUsers", query] as const,
  presence: (userId: number) => ["presence", userId] as const,
  onlineUsers: ["onlineUsers"] as const
};
