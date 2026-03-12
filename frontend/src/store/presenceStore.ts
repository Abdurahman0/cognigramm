"use client";

import { create } from "zustand";

import type { PresenceState } from "@/types/presence";

interface PresenceStoreState {
  onlineUserIds: Set<number>;
  userPresence: Record<number, PresenceState>;
  typingByConversation: Record<number, Set<number>>;
  setOnlineUsers: (userIds: number[]) => void;
  markOnline: (userId: number) => void;
  markOffline: (userId: number, lastSeen?: string | null) => void;
  upsertPresence: (presence: PresenceState) => void;
  setTypingUsers: (conversationId: number, userIds: number[]) => void;
}

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  onlineUserIds: new Set<number>(),
  userPresence: {},
  typingByConversation: {},
  setOnlineUsers: (userIds) => {
    set({
      onlineUserIds: new Set(userIds)
    });
  },
  markOnline: (userId) => {
    const next = new Set(get().onlineUserIds);
    next.add(userId);
    const current = get().userPresence[userId];
    set({
      onlineUserIds: next,
      userPresence: {
        ...get().userPresence,
        [userId]: current
          ? { ...current, is_online: true, last_seen: current.last_seen }
          : {
              user_id: userId,
              is_online: true,
              active_conversation_id: null,
              sessions: 1,
              last_seen: null,
              updated_at: new Date().toISOString()
            }
      }
    });
  },
  markOffline: (userId, lastSeen) => {
    const next = new Set(get().onlineUserIds);
    next.delete(userId);
    const current = get().userPresence[userId];
    set({
      onlineUserIds: next,
      userPresence: {
        ...get().userPresence,
        [userId]: current
          ? { ...current, is_online: false, last_seen: lastSeen ?? current.last_seen }
          : {
              user_id: userId,
              is_online: false,
              active_conversation_id: null,
              sessions: 0,
              last_seen: lastSeen ?? new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
      }
    });
  },
  upsertPresence: (presence) => {
    const online = new Set(get().onlineUserIds);
    if (presence.is_online) {
      online.add(presence.user_id);
    } else {
      online.delete(presence.user_id);
    }
    set({
      onlineUserIds: online,
      userPresence: {
        ...get().userPresence,
        [presence.user_id]: presence
      }
    });
  },
  setTypingUsers: (conversationId, userIds) => {
    set({
      typingByConversation: {
        ...get().typingByConversation,
        [conversationId]: new Set(userIds)
      }
    });
  }
}));
