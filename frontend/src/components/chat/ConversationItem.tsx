"use client";

import { UserGroupIcon } from "@heroicons/react/24/solid";

import { usePresenceStore } from "@/store/presenceStore";
import type { Conversation } from "@/types/conversation";
import { formatMessageTime } from "@/utils/date";
import { cn } from "@/utils/cn";

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  currentUserId?: number;
  previewText: string;
  previewTime: string | null;
  unreadCount: number;
  onClick: (conversationId: number) => void;
}

export function ConversationItem({
  conversation,
  active,
  currentUserId,
  previewText,
  previewTime,
  unreadCount,
  onClick
}: ConversationItemProps): JSX.Element {
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const directPeer = conversation.type === "direct"
    ? conversation.participants.find((p) => p.user_id !== currentUserId)
    : null;
  const title = conversation.type === "group"
    ? conversation.title || `Group #${conversation.id}`
    : directPeer?.username || `User #${conversation.id}`;
  const isOnline = directPeer ? onlineUserIds.has(directPeer.user_id) : false;
  const avatarLetter = title.charAt(0).toUpperCase();
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={() => onClick(conversation.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
        active
          ? "bg-[var(--messenger-active)]"
          : "hover:bg-[var(--messenger-hover)]"
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {conversation.type === "group" ? (
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-gradient-to-br from-[#a78bfa] to-[#8b5cf6]">
            <UserGroupIcon className="h-6 w-6 text-white" />
          </div>
        ) : (
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-gradient-to-br from-[#60a5fa] to-[#3b82f6] text-[20px] font-bold text-white">
            {avatarLetter}
          </div>
        )}
        {/* Online indicator */}
        {isOnline && (
          <span className="absolute bottom-0.5 right-0.5 h-[14px] w-[14px] rounded-full border-2 border-[var(--messenger-sidebar-bg)] bg-[var(--messenger-online)]" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className={cn(
              "truncate text-[15px]",
              hasUnread ? "font-bold text-[var(--foreground)]" : "font-semibold text-[var(--foreground)]"
            )}
          >
            {title}
          </span>
          {previewTime ? (
            <span
              className={cn(
                "shrink-0 text-[11px]",
                hasUnread ? "font-semibold text-[var(--primary)]" : "text-[var(--muted)]"
              )}
            >
              {formatMessageTime(previewTime)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-1">
          <p
            className={cn(
              "truncate text-[13px]",
              hasUnread ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"
            )}
          >
            {previewText}
          </p>
          {hasUnread ? (
            <span className="ml-1 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[11px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
