import type {
  DeliveryReceipt,
  MessageAttachmentInput,
  Message,
  MessageSearchResult,
  PresignedUploadRequest,
  PresignedUploadResponse
} from "@/types/message";

import { httpClient } from "@/services/api/httpClient";

export const messagesApi = {
  async listByConversation(conversationId: number, limit = 50, offset = 0): Promise<Message[]> {
    const { data } = await httpClient.get<Message[]>(`/conversations/${conversationId}/messages`, {
      params: { limit, offset }
    });
    return data;
  },
  async getLatestByConversation(conversationId: number): Promise<Message | null> {
    const { data } = await httpClient.get<Message | null>(`/conversations/${conversationId}/messages/latest`);
    return data;
  },
  async searchConversation(conversationId: number, query: string, limit = 25, offset = 0): Promise<MessageSearchResult[]> {
    const { data } = await httpClient.get<MessageSearchResult[]>(`/conversations/${conversationId}/messages/search`, {
      params: { q: query, limit, offset }
    });
    return data;
  },
  async editMessage(messageId: number, content: string): Promise<Message> {
    const { data } = await httpClient.patch<Message>(`/messages/${messageId}`, { content });
    return data;
  },
  async deleteMessage(messageId: number): Promise<Message> {
    const { data } = await httpClient.delete<Message>(`/messages/${messageId}`);
    return data;
  },
  async markRead(messageId: number): Promise<void> {
    await httpClient.post(`/messages/${messageId}/read`);
  },
  async listDelivery(messageId: number): Promise<DeliveryReceipt[]> {
    const { data } = await httpClient.get<DeliveryReceipt[]>(`/messages/${messageId}/delivery`);
    return data;
  },
  async createUploadUrl(payload: PresignedUploadRequest): Promise<PresignedUploadResponse> {
    const { data } = await httpClient.post<PresignedUploadResponse>("/files/presign", payload);
    return data;
  },
  async uploadToPresignedUrl(url: string, file: File, contentType: string): Promise<void> {
    await fetch(url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": contentType
      }
    });
  },
  async uploadLocalAttachment(file: File): Promise<MessageAttachmentInput> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await httpClient.post<{
      bucket: string;
      object_key: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      public_url: string;
    }>("/files/upload-local", formData);
    return {
      bucket: data.bucket,
      object_key: data.object_key,
      original_name: data.original_name,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      public_url: data.public_url
    };
  }
};
