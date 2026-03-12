"use client";

import { create } from "zustand";

import type { Conversation } from "@/types/conversation";

interface ConversationState {
  conversations: Conversation[];
  conversationsById: Record<number, Conversation>;
  activeConversationId: number | null;
  setConversations: (conversations: Conversation[]) => void;
  upsertConversation: (conversation: Conversation) => void;
  setActiveConversationId: (conversationId: number | null) => void;
  removeConversationMember: (conversationId: number, userId: number) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  conversationsById: {},
  activeConversationId: null,
  setConversations: (conversations) => {
    const sorted = [...conversations].sort((a, b) => b.id - a.id);
    const map = sorted.reduce<Record<number, Conversation>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
    set({
      conversations: sorted,
      conversationsById: map
    });
  },
  upsertConversation: (conversation) => {
    const existing = get().conversationsById[conversation.id];
    const nextConversations = existing
      ? get().conversations.map((item) => (item.id === conversation.id ? conversation : item))
      : [conversation, ...get().conversations];
    const sorted = nextConversations.sort((a, b) => b.id - a.id);
    set({
      conversations: sorted,
      conversationsById: { ...get().conversationsById, [conversation.id]: conversation }
    });
  },
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
  removeConversationMember: (conversationId, userId) => {
    const current = get().conversationsById[conversationId];
    if (!current) {
      return;
    }
    const updated: Conversation = {
      ...current,
      participants: current.participants.filter((participant) => participant.user_id !== userId)
    };
    get().upsertConversation(updated);
  }
}));
