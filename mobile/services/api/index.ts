import { apiRequest } from "@/services/api/httpClient";
import type {
  ApiConversation,
  ApiDeliveryState,
  ApiDeliveryReceipt,
  ApiLocalUploadResponse,
  ApiMessage,
  ApiMessageAttachmentOut,
  ApiMessageAttachmentIn,
  ApiMessageType,
  ApiMessageSearchResult,
  ApiPresignedUploadRequest,
  ApiPresignedUploadResponse,
  ApiPresenceState,
  ApiSocketEnvelope,
  ApiTokenResponse,
  ApiTypingState,
  ApiUser
} from "@/services/api/types";

interface ListParams {
  limit?: number;
  offset?: number;
}

interface UserSearchParams extends ListParams {
  q?: string;
  includeSelf?: boolean;
}

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

interface LoginPayload {
  identifier: string;
  password: string;
}

interface CreateConversationPayload {
  type: "direct" | "group";
  title?: string;
  participant_ids: number[];
}

interface SendMessagePayload {
  conversation_id: number;
  content: string | null;
  type: "text" | "image" | "file" | "voice" | "system";
  client_message_id: string;
  attachments: ApiMessageAttachmentIn[];
}

export const authApi = {
  register(payload: RegisterPayload): Promise<ApiUser> {
    return apiRequest<ApiUser>("/auth/register", {
      method: "POST",
      body: payload
    });
  },
  login(payload: LoginPayload): Promise<ApiTokenResponse> {
    return apiRequest<ApiTokenResponse>("/auth/login", {
      method: "POST",
      body: payload
    });
  }
};

export const usersApi = {
  me(token: string): Promise<ApiUser> {
    return apiRequest<ApiUser>("/users/me", { token });
  },
  search(token: string, params: UserSearchParams = {}): Promise<ApiUser[]> {
    return apiRequest<ApiUser[]>("/users", {
      token,
      query: {
        q: params.q?.trim() || undefined,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
        include_self: params.includeSelf ?? false
      }
    });
  },
  updateMe(token: string, payload: Partial<{
    full_name: string | null;
    avatar_url: string | null;
    title: string | null;
    about: string | null;
    timezone: string | null;
    phone: string | null;
    handle: string | null;
    office_location: string | null;
    manager_id: number | null;
    status: ApiUser["status"] | null;
    role_id: number | null;
    department_id: number | null;
  }>): Promise<ApiUser> {
    return apiRequest<ApiUser>("/users/me", {
      method: "PATCH",
      token,
      body: payload
    });
  },
  updateMyStatus(token: string, status: ApiUser["status"]): Promise<ApiUser> {
    return apiRequest<ApiUser>("/users/me/status", {
      method: "PATCH",
      token,
      body: { status }
    });
  }
};

export const conversationsApi = {
  list(token: string, params: ListParams = {}): Promise<ApiConversation[]> {
    return apiRequest<ApiConversation[]>("/conversations", {
      token,
      query: {
        limit: params.limit ?? 100,
        offset: params.offset ?? 0
      }
    });
  },
  getById(token: string, conversationId: number): Promise<ApiConversation> {
    return apiRequest<ApiConversation>(`/conversations/${conversationId}`, { token });
  },
  create(token: string, payload: CreateConversationPayload): Promise<ApiConversation> {
    return apiRequest<ApiConversation>("/conversations", {
      method: "POST",
      token,
      body: payload
    });
  },
  addMembers(token: string, conversationId: number, userIds: number[]): Promise<ApiConversation> {
    return apiRequest<ApiConversation>(`/conversations/${conversationId}/members`, {
      method: "POST",
      token,
      body: { user_ids: userIds }
    });
  },
  removeMember(token: string, conversationId: number, userId: number): Promise<ApiConversation> {
    return apiRequest<ApiConversation>(`/conversations/${conversationId}/members/${userId}`, {
      method: "DELETE",
      token
    });
  }
};

export const messagesApi = {
  listByConversation(token: string, conversationId: number, params: ListParams = {}): Promise<ApiMessage[]> {
    return apiRequest<ApiMessage[]>(`/conversations/${conversationId}/messages`, {
      token,
      query: {
        limit: params.limit ?? 50,
        offset: params.offset ?? 0
      }
    });
  },
  getLatestByConversation(token: string, conversationId: number): Promise<ApiMessage | null> {
    return apiRequest<ApiMessage | null>(`/conversations/${conversationId}/messages/latest`, { token });
  },
  searchConversation(
    token: string,
    conversationId: number,
    query: string,
    params: ListParams = {}
  ): Promise<ApiMessageSearchResult[]> {
    return apiRequest<ApiMessageSearchResult[]>(`/conversations/${conversationId}/messages/search`, {
      token,
      query: {
        q: query,
        limit: params.limit ?? 25,
        offset: params.offset ?? 0
      }
    });
  },
  editMessage(token: string, messageId: number, content: string): Promise<ApiMessage> {
    return apiRequest<ApiMessage>(`/messages/${messageId}`, {
      method: "PATCH",
      token,
      body: { content }
    });
  },
  deleteMessage(token: string, messageId: number): Promise<ApiMessage> {
    return apiRequest<ApiMessage>(`/messages/${messageId}`, {
      method: "DELETE",
      token
    });
  },
  markRead(token: string, messageId: number): Promise<void> {
    return apiRequest<void>(`/messages/${messageId}/read`, {
      method: "POST",
      token
    });
  },
  listDelivery(token: string, messageId: number): Promise<ApiDeliveryReceipt[]> {
    return apiRequest<ApiDeliveryReceipt[]>(`/messages/${messageId}/delivery`, { token });
  },
  createUploadUrl(token: string, payload: ApiPresignedUploadRequest): Promise<ApiPresignedUploadResponse> {
    return apiRequest<ApiPresignedUploadResponse>("/files/presign", {
      method: "POST",
      token,
      body: payload
    });
  },
  uploadLocalAttachment(token: string, formData: FormData): Promise<ApiLocalUploadResponse> {
    return apiRequest<ApiLocalUploadResponse>("/files/upload-local", {
      method: "POST",
      token,
      body: formData
    });
  }
};

export const presenceApi = {
  getOnlineUsers(token: string, limit = 5000): Promise<number[]> {
    return apiRequest<number[]>("/presence/users/online", {
      token,
      query: { limit }
    });
  },
  getUserPresence(token: string, userId: number): Promise<ApiPresenceState> {
    return apiRequest<ApiPresenceState>(`/presence/users/${userId}`, { token });
  },
  getTyping(token: string, conversationId: number): Promise<ApiTypingState> {
    return apiRequest<ApiTypingState>(`/presence/conversations/${conversationId}/typing`, { token });
  },
  setActiveConversation(token: string, conversationId: number | null): Promise<ApiPresenceState> {
    return apiRequest<ApiPresenceState>("/presence/active-conversation", {
      method: "POST",
      token,
      body: {
        conversation_id: conversationId
      }
    });
  }
};

export type {
  ApiConversation,
  ApiDeliveryState,
  ApiDeliveryReceipt,
  ApiMessage,
  ApiMessageAttachmentIn,
  ApiMessageAttachmentOut,
  ApiMessageType,
  ApiMessageSearchResult,
  ApiPresenceState,
  ApiSocketEnvelope,
  ApiTokenResponse,
  ApiTypingState,
  ApiUser
} from "@/services/api/types";

export type { SendMessagePayload };
