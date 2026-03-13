"use client";

import { toast } from "sonner";

import { conversationsApi } from "@/services/api";
import { queryClient } from "@/services/query/queryClient";
import { queryKeys } from "@/services/query/queryKeys";
import { useConversationStore } from "@/store/conversationStore";
import { useMessageStore } from "@/store/messageStore";
import { usePresenceStore } from "@/store/presenceStore";
import { useUserStore } from "@/store/userStore";
import type { Message } from "@/types/message";
import type { MissedMessagesPayload, SocketEnvelope } from "@/types/websocket";

export function routeWebSocketEvent(envelope: SocketEnvelope): void {
  const { event, payload } = envelope;
  const conversationStore = useConversationStore.getState();
  const messageStore = useMessageStore.getState();
  const presenceStore = usePresenceStore.getState();

  if (event === "connected") {
    if (Array.isArray((payload as { online_users?: number[] }).online_users)) {
      presenceStore.setOnlineUsers((payload as { online_users: number[] }).online_users);
    }
    return;
  }

  if (event === "message_queued") {
    messageStore.markMessageLocalState(
      (payload as { conversation_id: number }).conversation_id,
      (payload as { client_message_id: string }).client_message_id,
      "pending"
    );
    return;
  }

  if (event === "message_persisted") {
    const message = payload as unknown as Message;
    messageStore.upsertMessage(message.conversation_id, { ...message, local_state: "synced" });
    if (!conversationStore.conversationsById[message.conversation_id]) {
      conversationsApi
        .getById(message.conversation_id)
        .then((conversation) => {
          useConversationStore.getState().upsertConversation(conversation);
        })
        .catch(() => undefined);
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.conversation(message.conversation_id) }).catch(() => undefined);
    return;
  }

  if (event === "message_persisted_ack") {
    messageStore.markMessageLocalState(
      (payload as { conversation_id: number }).conversation_id,
      (payload as { client_message_id: string }).client_message_id,
      "synced"
    );
    return;
  }

  if (event === "message_retrying") {
    return;
  }

  if (event === "message_failed") {
    const data = payload as { client_message_id: string; detail?: string };
    const conversationId = useConversationStore.getState().activeConversationId;
    if (conversationId) {
      messageStore.markMessageLocalState(conversationId, data.client_message_id, "failed");
    }
    toast.error(data.detail || "Message failed");
    return;
  }

  if (event === "message_delivered") {
    const data = payload as { message_id: number; user_id: number; delivered_at?: string | null };
    const conversationId = useConversationStore.getState().activeConversationId;
    if (conversationId) {
      messageStore.updateMessageDelivery(conversationId, data.message_id, {
        state: "delivered",
        delivered_at: data.delivered_at ?? null
      });
    }
    return;
  }

  if (event === "message_read") {
    const data = payload as { message_id: number; user_id: number; read_at?: string | null };
    const currentUserId = useUserStore.getState().currentUser?.id;
    if (currentUserId && data.user_id === currentUserId) {
      const conversations = Object.entries(useMessageStore.getState().byConversation);
      for (const [conversationIdRaw, messages] of conversations) {
        if (messages.some((message) => message.id === data.message_id)) {
          messageStore.markConversationMessagesRead(Number(conversationIdRaw), [data.message_id]);
          break;
        }
      }
    }
    const conversationId = useConversationStore.getState().activeConversationId;
    if (conversationId) {
      messageStore.updateMessageDelivery(conversationId, data.message_id, {
        state: "read",
        read_at: data.read_at ?? null
      });
    }
    return;
  }

  if (event === "message_delivery_state") {
    const data = payload as {
      message_id: number;
      state: "queued" | "persisted" | "delivered" | "read" | "failed";
      updated_at?: string | null;
    };
    const conversationId = useConversationStore.getState().activeConversationId;
    if (conversationId) {
      messageStore.updateMessageDelivery(conversationId, data.message_id, {
        state: data.state,
        delivery_updated_at: data.updated_at ?? null
      });
    }
    return;
  }

  if (event === "message_edited") {
    const editedMessage = payload as unknown as Message;
    messageStore.upsertMessage(editedMessage.conversation_id, editedMessage);
    return;
  }

  if (event === "message_deleted") {
    const data = payload as { message_id: number; conversation_id: number };
    messageStore.removeMessage(data.conversation_id, data.message_id);
    return;
  }

  if (event === "typing_start" || event === "typing_stop") {
    const data = payload as { conversation_id: number; typing_users: number[] };
    presenceStore.setTypingUsers(data.conversation_id, data.typing_users);
    return;
  }

  if (event === "user_online") {
    const data = payload as { user_id: number };
    presenceStore.markOnline(data.user_id);
    return;
  }

  if (event === "user_offline") {
    const data = payload as { user_id: number; last_seen?: string | null };
    presenceStore.markOffline(data.user_id, data.last_seen ?? null);
    return;
  }

  if (event === "last_seen_update") {
    const data = payload as {
      user_id: number;
      active_conversation_id: number | null;
      last_seen: string | null;
    };
    const existing = usePresenceStore.getState().userPresence[data.user_id];
    presenceStore.upsertPresence({
      user_id: data.user_id,
      is_online: existing?.is_online ?? false,
      active_conversation_id: data.active_conversation_id,
      sessions: existing?.sessions ?? 0,
      last_seen: data.last_seen,
      updated_at: new Date().toISOString()
    });
    return;
  }

  if (event === "missed_messages") {
    const data = payload as unknown as MissedMessagesPayload;
    for (const message of data.messages) {
      messageStore.upsertMessage(data.conversation_id, message);
    }
    return;
  }

  if (event === "rate_limited") {
    toast.warning("Rate limit reached");
    return;
  }

  if (event === "error") {
    const data = payload as { detail?: string };
    if (data.detail) {
      toast.error(data.detail);
    }
  }
}
