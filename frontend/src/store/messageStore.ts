"use client";

import { create } from "zustand";

import type { DeliveryState, Message } from "@/types/message";

interface MessageState {
  byConversation: Record<number, Message[]>;
  setConversationMessages: (conversationId: number, messages: Message[]) => void;
  prependOlderMessages: (conversationId: number, messages: Message[]) => void;
  upsertMessage: (conversationId: number, message: Message) => void;
  markMessageLocalState: (conversationId: number, clientMessageId: string, state: "pending" | "synced" | "failed") => void;
  updateMessageDelivery: (
    conversationId: number,
    messageId: number,
    delivery: {
      state: DeliveryState;
      delivered_at?: string | null;
      read_at?: string | null;
      delivery_updated_at?: string | null;
    }
  ) => void;
  removeMessage: (conversationId: number, messageId: number) => void;
}

function mergeUniqueMessages(messages: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const message of messages) {
    const key = `${message.id}-${message.client_message_id}`;
    map.set(key, message);
  }
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

export const useMessageStore = create<MessageState>((set, get) => ({
  byConversation: {},
  setConversationMessages: (conversationId, messages) => {
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: mergeUniqueMessages(messages)
      }
    }));
  },
  prependOlderMessages: (conversationId, messages) => {
    const existing = get().byConversation[conversationId] || [];
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: mergeUniqueMessages([...messages, ...existing])
      }
    }));
  },
  upsertMessage: (conversationId, message) => {
    const existing = get().byConversation[conversationId] || [];
    const sameIndex = existing.findIndex(
      (item) => item.id === message.id || item.client_message_id === message.client_message_id
    );
    const next =
      sameIndex >= 0 ? existing.map((item, index) => (index === sameIndex ? { ...item, ...message } : item)) : [...existing, message];
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: mergeUniqueMessages(next)
      }
    }));
  },
  markMessageLocalState: (conversationId, clientMessageId, stateValue) => {
    const existing = get().byConversation[conversationId] || [];
    const next = existing.map((message) =>
      message.client_message_id === clientMessageId ? { ...message, local_state: stateValue } : message
    );
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: next
      }
    }));
  },
  updateMessageDelivery: (conversationId, messageId, delivery) => {
    const existing = get().byConversation[conversationId] || [];
    const next = existing.map((message) =>
      message.id === messageId
        ? {
            ...message,
            delivery_state: delivery.state,
            delivered_at: delivery.delivered_at ?? message.delivered_at,
            read_at: delivery.read_at ?? message.read_at,
            delivery_updated_at: delivery.delivery_updated_at ?? message.delivery_updated_at
          }
        : message
    );
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: next
      }
    }));
  },
  removeMessage: (conversationId, messageId) => {
    const existing = get().byConversation[conversationId] || [];
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: existing.filter((message) => message.id !== messageId)
      }
    }));
  }
}));
