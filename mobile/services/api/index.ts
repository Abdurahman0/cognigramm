import { apiRequest } from "@/services/api/httpClient";
import { CLIENT_TYPE } from "@/services/api/session";
import { describeDevice } from "@/services/deviceName";
import type {
  ApiCallsHistoryResponse,
  ApiCallSession,
  ApiConversation,
  ApiDeliveryReceipt,
  ApiDeliveryState,
  ApiMessageSearchHit,
  ApiTypingState,
  ApiLocalUploadResponse,
  ApiMessage,
  ApiMessageAttachmentOut,
  ApiMessageAttachmentIn,
  ApiMessageType,
  ApiPresignedUploadRequest,
  ApiPresignedUploadResponse,
  ApiPresenceState,
  ApiSocketEnvelope,
  ApiTokenResponse,
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
  /** Shown in the account's device list, so a row can be recognised there. */
  device_name?: string;
  client_type?: "mobile" | "web";
}

/** One row of `GET /auth/sessions`: a device that can refresh into this account. */
export interface ApiDeviceSession {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  is_current: boolean;
}

/** `GET /files/access` — a fresh signed GET URL for a stored object. */
export interface ApiFileAccess {
  url: string;
  expires_in: number;
}

export type ApiChangeEvent =
  | "message_created"
  | "message_edited"
  | "message_deleted"
  | "message_pinned"
  | "message_unpinned";

/**
 * One entry of the per-conversation change feed. `message` is the message's
 * *current* state, not a snapshot of when the change happened, so entries
 * apply as upserts and their order does not matter.
 */
export interface ApiChangeItem {
  cursor: number;
  event: ApiChangeEvent;
  message: ApiMessage;
}

export interface ApiChangesPage {
  items: ApiChangeItem[];
  next_cursor: number;
  has_more: boolean;
}

interface CreateConversationPayload {
  type: "direct" | "group";
  title?: string;
  participant_ids: number[];
}

interface SendMessagePayload {
  conversation_id: number;
  content: string | null;
  type: "text" | "image" | "file" | "voice" | "video_note" | "system";
  client_message_id: string;
  attachments: ApiMessageAttachmentIn[];
}

export const authApi = {
  register(payload: RegisterPayload): Promise<ApiUser> {
    return apiRequest<ApiUser>("/auth/register", {
      method: "POST",
      body: payload,
      anonymous: true
    });
  },
  login(payload: LoginPayload): Promise<ApiTokenResponse> {
    return apiRequest<ApiTokenResponse>("/auth/login", {
      method: "POST",
      body: { client_type: CLIENT_TYPE, device_name: describeDevice(), ...payload },
      anonymous: true
    });
  },
  /** Device sessions for this account, newest activity first. */
  sessions(): Promise<ApiDeviceSession[]> {
    return apiRequest<ApiDeviceSession[]>("/auth/sessions");
  },
  revokeSession(sessionId: string): Promise<{ status: string }> {
    return apiRequest<{ status: string }>(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE"
    });
  },
  /** Ends this device's session; any open socket closes with code 4001. */
  logout(): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("/auth/logout", { method: "POST" });
  },
  logoutAll(): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("/auth/logout-all", { method: "POST" });
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
  /** Presence status is its own endpoint, separate from the profile patch. */
  updateStatus(token: string, status: ApiUser["status"]): Promise<ApiUser> {
    return apiRequest<ApiUser>("/users/me/status", {
      method: "PATCH",
      token,
      body: { status }
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
  },
  /**
   * Everything that happened to this conversation's messages after `afterId`.
   * This is the recovery path for events missed while the socket was down.
   */
  changes(token: string, conversationId: number, afterId = 0, limit = 100): Promise<ApiChangesPage> {
    return apiRequest<ApiChangesPage>(`/conversations/${conversationId}/changes`, {
      token,
      query: { after_id: afterId, limit }
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
  listPinned(token: string, conversationId: number, params: ListParams = {}): Promise<ApiMessage[]> {
    return apiRequest<ApiMessage[]>(`/conversations/${conversationId}/messages/pinned`, {
      token,
      query: { limit: params.limit ?? 50, offset: params.offset ?? 0 }
    });
  },
  search(
    token: string,
    conversationId: number,
    term: string,
    params: ListParams = {}
  ): Promise<ApiMessageSearchHit[]> {
    return apiRequest<ApiMessageSearchHit[]>(`/conversations/${conversationId}/messages/search`, {
      token,
      query: { q: term, limit: params.limit ?? 25, offset: params.offset ?? 0 }
    });
  },
  pin(token: string, messageId: number): Promise<ApiMessage> {
    return apiRequest<ApiMessage>(`/messages/${messageId}/pin`, { method: "POST", token });
  },
  unpin(token: string, messageId: number): Promise<ApiMessage> {
    return apiRequest<ApiMessage>(`/messages/${messageId}/unpin`, { method: "POST", token });
  },
  getDeliveryReceipts(token: string, messageId: number): Promise<ApiDeliveryReceipt[]> {
    return apiRequest<ApiDeliveryReceipt[]>(`/messages/${messageId}/delivery`, { token });
  },
  getLatestByConversation(token: string, conversationId: number): Promise<ApiMessage | null> {
    return apiRequest<ApiMessage | null>(`/conversations/${conversationId}/messages/latest`, { token });
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
  createUploadUrl(token: string, payload: ApiPresignedUploadRequest): Promise<ApiPresignedUploadResponse> {
    return apiRequest<ApiPresignedUploadResponse>("/files/presign", {
      method: "POST",
      token,
      body: payload
    });
  },
  /**
   * Multipart upload to S3 through the backend. The response's `public_url` is
   * a signed URL that expires in about 15 minutes — persist `bucket` and
   * `object_key`, and re-sign through `filesApi.access` when it runs out.
   */
  uploadLocalAttachment(token: string, formData: FormData): Promise<ApiLocalUploadResponse> {
    return apiRequest<ApiLocalUploadResponse>("/files/upload", {
      method: "POST",
      token,
      body: formData
    });
  },
  /** A fresh signed GET URL for an object whose previous one expired. */
  fileAccess(objectKey: string): Promise<ApiFileAccess> {
    return apiRequest<ApiFileAccess>("/files/access", {
      query: { object_key: objectKey }
    });
  }
};

export const presenceApi = {
  getTyping(token: string, conversationId: number): Promise<ApiTypingState> {
    return apiRequest<ApiTypingState>(`/presence/conversations/${conversationId}/typing`, { token });
  },
  getOnlineUsers(token: string, limit = 5000): Promise<number[]> {
    return apiRequest<number[]>("/presence/users/online", {
      token,
      query: { limit }
    });
  },
  getUserPresence(token: string, userId: number): Promise<ApiPresenceState> {
    return apiRequest<ApiPresenceState>(`/presence/users/${userId}`, { token });
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

export const systemApi = {
  /** Cheap reachability probe; the only endpoint that needs no token. */
  health(): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("/health");
  }
};

export const callsApi = {
  getHistory(token: string, params: ListParams = {}): Promise<ApiCallsHistoryResponse> {
    return apiRequest<ApiCallsHistoryResponse>("/calls/history", {
      token,
      query: {
        limit: params.limit ?? 30,
        offset: params.offset ?? 0
      }
    });
  },
  getById(token: string, callId: string): Promise<ApiCallSession> {
    return apiRequest<ApiCallSession>(`/calls/${encodeURIComponent(callId)}`, { token });
  }
};

export type {
  ApiCallsHistoryResponse,
  ApiCallSession,
  ApiConversation,
  ApiDeliveryReceipt,
  ApiDeliveryState,
  ApiMessageSearchHit,
  ApiTypingState,
  ApiMessage,
  ApiMessageAttachmentIn,
  ApiMessageAttachmentOut,
  ApiMessageType,
  ApiPresenceState,
  ApiSocketEnvelope,
  ApiTokenResponse,
  ApiUser
} from "@/services/api/types";

export type { SendMessagePayload };
