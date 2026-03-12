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
import { UserPresenceBadge } from "@/components/presence/UserPresenceBadge";
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
      <div className="hidden h-full items-center justify-center md:flex">
        <p className="text-base text-[var(--muted)]">Select a chat to start messaging</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center p-6">
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

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden"
        >
          <ArrowLeftIcon className="h-6 w-6 text-[var(--foreground)]" />
        </button>

        <div className="relative h-10 w-10 shrink-0 rounded-full bg-[var(--secondary)]" />

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="text-xs text-[var(--muted)]">{subtitle}</p>
        </div>

        {conversation.type === "direct" && directPeer ? (
          <UserPresenceBadge isOnline={isOnline} lastSeen={lastSeen} compact />
        ) : null}

        <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--secondary)]">
          <PhoneIcon className="h-5 w-5 text-[var(--primary)]" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--secondary)]">
          <VideoCameraIcon className="h-5 w-5 text-[var(--primary)]" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--secondary)]">
          <InformationCircleIcon className="h-5 w-5 text-[var(--primary)]" />
        </button>
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
