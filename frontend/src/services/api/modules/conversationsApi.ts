import type { Conversation, CreateConversationPayload } from "@/types/conversation";

import { httpClient } from "@/services/api/httpClient";

export const conversationsApi = {
  async list(limit = 100, offset = 0): Promise<Conversation[]> {
    const { data } = await httpClient.get<Conversation[]>("/conversations", {
      params: { limit, offset }
    });
    return data;
  },
  async getById(id: number): Promise<Conversation> {
    const { data } = await httpClient.get<Conversation>(`/conversations/${id}`);
    return data;
  },
  async create(payload: CreateConversationPayload): Promise<Conversation> {
    const { data } = await httpClient.post<Conversation>("/conversations", payload);
    return data;
  },
  async addMembers(conversationId: number, userIds: number[]): Promise<Conversation> {
    const { data } = await httpClient.post<Conversation>(`/conversations/${conversationId}/members`, {
      user_ids: userIds
    });
    return data;
  },
  async removeMember(conversationId: number, userId: number): Promise<Conversation> {
    const { data } = await httpClient.delete<Conversation>(`/conversations/${conversationId}/members/${userId}`);
    return data;
  }
};
