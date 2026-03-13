"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  PhoneIcon,
  VideoCameraIcon
} from "@heroicons/react/24/outline";

import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList } from "@/components/chat/MessageList";
import { useConversationStore } from "@/store/conversationStore";
import { usePresenceStore } from "@/store/presenceStore";
import { useUIStore } from "@/store/uiStore";
import { useUserStore } from "@/store/userStore";
import type { Message } from "@/types/message";
import { formatLastSeen } from "@/utils/date";

interface ChatWindowProps {
  conversationId: number | null;
}

export function ChatWindow({ conversationId }: ChatWindowProps): JSX.Element {
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const currentUser = useUserStore((state) => state.currentUser);
  const presenceState = usePresenceStore((state) => state.userPresence);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);

  const conversation = useConversationStore((state) =>
    conversationId ? state.conversationsById[conversationId] : null
  );

  useEffect(() => {
    useConversationStore.getState().setActiveConversationId(conversationId);
  }, [conversationId]);

  useEffect(() => {
    setEditingMessage(null);
  }, [conversationId]);

  if (!conversationId) {
    return (
      <div className="hidden h-full flex-col items-center justify-center gap-4 md:flex" style={{ background: "var(--messenger-chat-bg)" }}>
        {/* Messenger logo */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0084ff] shadow-lg">
          <svg viewBox="0 0 48 48" fill="none" className="h-11 w-11" aria-hidden="true">
            <path
              d="M24 4C13 4 4 12.5 4 23c0 5.8 2.7 11 7 14.6V44l6.3-3.5C19.1 41.1 21.5 41.5 24 41.5c11 0 20-8.5 20-18.5S35 4 24 4z"
              fill="#ffffff"
            />
            <path
              d="M11 28l7-7.5 3.5 3.5 6.5-7 7 7.5-6.5 7-3.5-3.5L11 28z"
              fill="#0084ff"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-[var(--foreground)]">Your messages</p>
          <p className="mt-1 text-[14px] text-[var(--muted)]">Send private photos and messages to a friend or group.</p>
        </div>
        <button
          className="rounded-lg bg-[#0084ff] px-5 py-2 text-[15px] font-semibold text-white hover:bg-[#0073e6] transition"
          onClick={() => setMobileSidebarOpen(true)}
        >
          Send message
        </button>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center p-6" style={{ background: "var(--messenger-chat-bg)" }}>
        <p className="text-sm text-[var(--muted)]">Loading conversation...</p>
      </div>
    );
  }

  const directPeer = conversation.type === "direct"
    ? conversation.participants.find((participant) => participant.user_id !== currentUser?.id)
    : null;

  const title = conversation.type === "group"
    ? conversation.title || `Group #${conversation.id}`
    : directPeer?.username || `User #${conversation.id}`;

  const isOnline = directPeer ? onlineUserIds.has(directPeer.user_id) : false;
  const lastSeen = directPeer ? presenceState[directPeer.user_id]?.last_seen : null;
  const subtitle = conversation.type === "group"
    ? `${conversation.participants.length} members`
    : isOnline
      ? "Active now"
      : formatLastSeen(lastSeen);

  const avatarLetter = title.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--messenger-chat-bg)" }}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5" style={{ background: "var(--messenger-header-bg)" }}>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground)] transition hover:bg-[var(--secondary)] md:hidden"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <div className="relative shrink-0">
          {conversation.type === "group" ? (
            <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-gradient-to-br from-[#a78bfa] to-[#8b5cf6] text-white text-[16px] font-bold">
              {avatarLetter}
            </div>
          ) : (
            <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-gradient-to-br from-[#60a5fa] to-[#3b82f6] text-white text-[16px] font-bold">
              {avatarLetter}
            </div>
          )}
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--messenger-header-bg)] bg-[var(--messenger-online)]" />
          )}
        </div>

        {/* Name and status */}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold text-[var(--foreground)]">{title}</h2>
          <p className={`text-[12px] ${isOnline ? "text-[var(--messenger-online)]" : "text-[var(--muted)]"}`}>
            {subtitle}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <button
            title="Start voice call"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--primary)] transition hover:bg-[var(--secondary)]"
          >
            <PhoneIcon className="h-5 w-5" />
          </button>
          <button
            title="Start video call"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--primary)] transition hover:bg-[var(--secondary)]"
          >
            <VideoCameraIcon className="h-5 w-5" />
          </button>
          <button
            title="Conversation info"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--primary)] transition hover:bg-[var(--secondary)]"
          >
            <InformationCircleIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <MessageList
        conversationId={conversationId}
        onScrollToTop={() => {}}
        onRequestEdit={(message) => setEditingMessage(message)}
      />

      <MessageInput
        conversationId={conversationId}
        editingMessage={editingMessage}
        onCancelEditing={() => setEditingMessage(null)}
      />
    </div>
  );
}
