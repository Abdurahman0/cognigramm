import type { PresenceState, TypingState } from "@/types/presence";

import { httpClient } from "@/services/api/httpClient";

export const presenceApi = {
  async getUserPresence(userId: number): Promise<PresenceState> {
    const { data } = await httpClient.get<PresenceState>(`/presence/users/${userId}`);
    return data;
  },
  async getOnlineUsers(limit = 5000): Promise<number[]> {
    const { data } = await httpClient.get<number[]>("/presence/users/online", {
      params: { limit }
    });
    return data;
  },
  async getTyping(conversationId: number): Promise<TypingState> {
    const { data } = await httpClient.get<TypingState>(`/presence/conversations/${conversationId}/typing`);
    return data;
  },
  async setActiveConversation(conversationId: number | null): Promise<PresenceState> {
    const { data } = await httpClient.post<PresenceState>("/presence/active-conversation", {
      conversation_id: conversationId
    });
    return data;
  }
};
