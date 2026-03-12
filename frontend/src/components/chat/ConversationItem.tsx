"use client";

import { UserGroupIcon, UserIcon } from "@heroicons/react/24/solid";

import { UserPresenceBadge } from "@/components/presence/UserPresenceBadge";
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
  const presenceState = usePresenceStore((state) => state.userPresence);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const directPeer = conversation.type === "direct" ? conversation.participants.find((p) => p.user_id !== currentUserId) : null;
  const title = conversation.type === "group" ? conversation.title || `Group #${conversation.id}` : directPeer?.username || `User #${conversation.id}`;
  const isOnline = directPeer ? onlineUserIds.has(directPeer.user_id) : false;
  const lastSeen = directPeer ? presenceState[directPeer.user_id]?.last_seen : null;

  return (
    <button
      onClick={() => onClick(conversation.id)}
      className={cn(
        "w-full rounded-lg px-3 py-2 text-left transition",
        active
          ? "bg-[var(--messenger-active)]"
          : "hover:bg-[var(--messenger-hover)]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--foreground)]">
            {conversation.type === "group" ? <UserGroupIcon className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] text-[var(--foreground)]">{title}</p>
            <p className="truncate text-[13px] text-[var(--muted)]">
              {previewText}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {previewTime ? <span className="text-xs text-[var(--muted)]">{formatMessageTime(previewTime)}</span> : null}
          {unreadCount > 0 ? (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-bold text-[var(--primary-foreground)]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : conversation.type === "direct" && directPeer ? (
            <UserPresenceBadge isOnline={isOnline} lastSeen={lastSeen} compact />
          ) : null}
        </div>
      </div>
    </button>
  );
}
