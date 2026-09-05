import { apiRequest } from '@/api/client'
import type {
  ApiCallSession,
  ApiCallsHistoryResponse,
  ApiConversation,
  ApiDeliveryReceipt,
  ApiLocalUploadResponse,
  ApiMessage,
  ApiMessageSearchHit,
  ApiPresenceState,
  ApiPresignedUploadRequest,
  ApiPresignedUploadResponse,
  ApiTokenResponse,
  ApiTypingState,
  ApiUser,
} from '@/api/types'

interface Page {
  limit?: number
  offset?: number
}

/** Editable profile fields. Every one of them is nullable server-side. */
export interface ProfilePatch {
  full_name?: string | null
  avatar_url?: string | null
  title?: string | null
  about?: string | null
  timezone?: string | null
  phone?: string | null
  handle?: string | null
  office_location?: string | null
  manager_id?: number | null
  role_id?: number | null
  department_id?: number | null
}

export const authApi = {
  login(payload: { identifier: string; password: string }) {
    return apiRequest<ApiTokenResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      anonymous: true,
    })
  },
  register(payload: { username: string; email: string; password: string }) {
    return apiRequest<ApiUser>('/auth/register', {
      method: 'POST',
      body: payload,
      anonymous: true,
    })
  },
}

export const usersApi = {
  me() {
    return apiRequest<ApiUser>('/users/me')
  },
  search(params: Page & { q?: string; includeSelf?: boolean } = {}) {
    return apiRequest<ApiUser[]>('/users', {
      query: {
        q: params.q?.trim() || undefined,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
        include_self: params.includeSelf ?? false,
      },
    })
  },
  updateMe(payload: ProfilePatch) {
    return apiRequest<ApiUser>('/users/me', { method: 'PATCH', body: payload })
  },
  /** Presence status has its own endpoint, separate from the profile patch. */
  updateStatus(status: ApiUser['status']) {
    return apiRequest<ApiUser>('/users/me/status', { method: 'PATCH', body: { status } })
  },
}

export const conversationsApi = {
  list(params: Page = {}) {
    return apiRequest<ApiConversation[]>('/conversations', {
      query: { limit: params.limit ?? 100, offset: params.offset ?? 0 },
    })
  },
  getById(conversationId: number) {
    return apiRequest<ApiConversation>(`/conversations/${conversationId}`)
  },
  create(payload: { type: 'direct' | 'group'; title?: string; participant_ids: number[] }) {
    return apiRequest<ApiConversation>('/conversations', { method: 'POST', body: payload })
  },
  addMembers(conversationId: number, userIds: number[]) {
    return apiRequest<ApiConversation>(`/conversations/${conversationId}/members`, {
      method: 'POST',
      body: { user_ids: userIds },
    })
  },
  removeMember(conversationId: number, userId: number) {
    return apiRequest<ApiConversation>(`/conversations/${conversationId}/members/${userId}`, {
      method: 'DELETE',
    })
  },
}

export const messagesApi = {
  list(conversationId: number, params: Page = {}) {
    return apiRequest<ApiMessage[]>(`/conversations/${conversationId}/messages`, {
      query: { limit: params.limit ?? 50, offset: params.offset ?? 0 },
    })
  },
  latest(conversationId: number) {
    return apiRequest<ApiMessage | null>(`/conversations/${conversationId}/messages/latest`)
  },
  pinned(conversationId: number, params: Page = {}) {
    return apiRequest<ApiMessage[]>(`/conversations/${conversationId}/messages/pinned`, {
      query: { limit: params.limit ?? 50, offset: params.offset ?? 0 },
    })
  },
  search(conversationId: number, term: string, params: Page = {}) {
    return apiRequest<ApiMessageSearchHit[]>(`/conversations/${conversationId}/messages/search`, {
      query: { q: term, limit: params.limit ?? 25, offset: params.offset ?? 0 },
    })
  },
  edit(messageId: number, content: string) {
    return apiRequest<ApiMessage>(`/messages/${messageId}`, { method: 'PATCH', body: { content } })
  },
  remove(messageId: number) {
    return apiRequest<ApiMessage>(`/messages/${messageId}`, { method: 'DELETE' })
  },
  pin(messageId: number) {
    return apiRequest<ApiMessage>(`/messages/${messageId}/pin`, { method: 'POST' })
  },
  unpin(messageId: number) {
    return apiRequest<ApiMessage>(`/messages/${messageId}/unpin`, { method: 'POST' })
  },
  markRead(messageId: number) {
    return apiRequest<void>(`/messages/${messageId}/read`, { method: 'POST' })
  },
  deliveryReceipts(messageId: number) {
    return apiRequest<ApiDeliveryReceipt[]>(`/messages/${messageId}/delivery`)
  },
}

export const filesApi = {
  /** Multipart upload that returns an attachment ready to attach to a message. */
  uploadLocal(file: File, onProgress?: (fraction: number) => void) {
    const form = new FormData()
    form.append('file', file)
    onProgress?.(0)
    return apiRequest<ApiLocalUploadResponse>('/files/upload-local', {
      method: 'POST',
      body: form,
    }).then((result) => {
      onProgress?.(1)
      return result
    })
  },
  presign(payload: ApiPresignedUploadRequest) {
    return apiRequest<ApiPresignedUploadResponse>('/files/presign', {
      method: 'POST',
      body: payload,
    })
  },
}

export const presenceApi = {
  onlineUsers(limit = 5000) {
    return apiRequest<number[]>('/presence/users/online', { query: { limit } })
  },
  ofUser(userId: number) {
    return apiRequest<ApiPresenceState>(`/presence/users/${userId}`)
  },
  typing(conversationId: number) {
    return apiRequest<ApiTypingState>(`/presence/conversations/${conversationId}/typing`)
  },
  setActiveConversation(conversationId: number | null) {
    return apiRequest<ApiPresenceState>('/presence/active-conversation', {
      method: 'POST',
      body: { conversation_id: conversationId },
    })
  },
}

export const callsApi = {
  history(params: Page = {}) {
    return apiRequest<ApiCallsHistoryResponse>('/calls/history', {
      query: { limit: params.limit ?? 30, offset: params.offset ?? 0 },
    })
  },
  getById(callId: string) {
    return apiRequest<ApiCallSession>(`/calls/${encodeURIComponent(callId)}`)
  },
}

export const systemApi = {
  /** Cheap reachability probe; the only endpoint that needs no token. */
  health() {
    return apiRequest<{ status: string }>('/health', { anonymous: true })
  },
}
