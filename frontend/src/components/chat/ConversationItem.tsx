"use client";

import { usePresenceStore } from "@/store/presenceStore";
import type { Conversation } from "@/types/conversation";
import { formatMessageTime } from "@/utils/date";

/* Deterministic avatar color per user id */
const AVATAR_COLORS = [
  ["#3b82f6", "#1d4ed8"], // blue
  ["#8b5cf6", "#6d28d9"], // purple
  ["#ec4899", "#be185d"], // pink
  ["#f97316", "#c2410c"], // orange
  ["#10b981", "#065f46"], // green
  ["#f59e0b", "#b45309"], // amber
];
function avatarGradient(id: number): [string, string] {
  return AVATAR_COLORS[id % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

interface Props {
  conversation: Conversation;
  active: boolean;
  currentUserId?: number;
  previewText: string;
  previewTime: string | null;
  unreadCount: number;
  onClick: (id: number) => void;
}

export function ConversationItem({
  conversation,
  active,
  currentUserId,
  previewText,
  previewTime,
  unreadCount,
  onClick,
}: Props): JSX.Element {
  const onlineIds = usePresenceStore((s) => s.onlineUserIds);

  const peer =
    conversation.type === "direct"
      ? conversation.participants.find((p) => p.user_id !== currentUserId)
      : null;

  const name =
    conversation.type === "group"
      ? conversation.title || `Group #${conversation.id}`
      : peer?.username ?? `User #${conversation.id}`;

  const avatarId = peer?.user_id ?? conversation.id;
  const [c1, c2] = avatarGradient(avatarId);
  const isOnline = peer ? onlineIds.has(peer.user_id) : false;
  const unread = unreadCount > 0;

  return (
    <button
      onClick={() => onClick(conversation.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-[6px] text-left transition-colors"
      style={{
        background: active ? "var(--surface-active)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className="flex h-[56px] w-[56px] items-center justify-center rounded-full text-[22px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        {isOnline && (
          <span
            className="absolute bottom-[2px] right-[2px] h-[14px] w-[14px] rounded-full border-2"
            style={{
              background: "var(--online)",
              borderColor: "var(--messenger-sidebar-bg)",
            }}
          />
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className="truncate text-[15px]"
            style={{
              color: "var(--fg)",
              fontWeight: unread ? 700 : 600,
            }}
          >
            {name}
          </span>
          {previewTime && (
            <span
              className="shrink-0 text-[11px]"
              style={{ color: unread ? "var(--blue)" : "var(--fg-secondary)", fontWeight: unread ? 600 : 400 }}
            >
              {formatMessageTime(previewTime)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <p
            className="truncate text-[13px]"
            style={{
              color: unread ? "var(--fg)" : "var(--fg-secondary)",
              fontWeight: unread ? 600 : 400,
            }}
          >
            {previewText}
          </p>
          {unread && (
            <span
              className="ml-1 inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
              style={{ background: "var(--blue)" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
