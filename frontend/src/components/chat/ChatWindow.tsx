"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  PhoneIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";

import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList } from "@/components/chat/MessageList";
import { useConversationStore } from "@/store/conversationStore";
import { usePresenceStore } from "@/store/presenceStore";
import { useUIStore } from "@/store/uiStore";
import { useUserStore } from "@/store/userStore";
import type { Message } from "@/types/message";
import { formatLastSeen } from "@/utils/date";

const AVATAR_COLORS: [string, string][] = [
  ["#3b82f6", "#1d4ed8"],
  ["#8b5cf6", "#6d28d9"],
  ["#ec4899", "#be185d"],
  ["#f97316", "#c2410c"],
  ["#10b981", "#065f46"],
  ["#f59e0b", "#b45309"],
];
function avatarGrad(id: number): string {
  const [c1, c2] = AVATAR_COLORS[id % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

interface Props {
  conversationId: number | null;
}

export function ChatWindow({ conversationId }: Props): JSX.Element {
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const currentUser = useUserStore((s) => s.currentUser);
  const presence = usePresenceStore((s) => s.userPresence);
  const onlineIds = usePresenceStore((s) => s.onlineUserIds);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  const conv = useConversationStore((s) =>
    conversationId ? s.conversationsById[conversationId] : null
  );

  useEffect(() => {
    useConversationStore.getState().setActiveConversationId(conversationId);
  }, [conversationId]);

  useEffect(() => { setEditingMsg(null); }, [conversationId]);

  /* ── Empty state ── */
  if (!conversationId) {
    return (
      <div
        className="hidden h-full flex-col items-center justify-center gap-4 md:flex"
        style={{ background: "var(--messenger-chat-bg)" }}
      >
        <MessengerLogo size={80} />
        <div className="text-center">
          <p className="text-[20px] font-bold" style={{ color: "var(--fg)" }}>Your messages</p>
          <p className="mt-1 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
            Send private photos and messages to a friend or group.
          </p>
        </div>
        <button
          className="rounded-xl px-5 py-2.5 text-[15px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--blue)" }}
          onClick={() => setMobileSidebarOpen(true)}
        >
          Send message
        </button>
      </div>
    );
  }

  if (!conv) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: "var(--messenger-chat-bg)" }}
      >
        <p className="text-[14px]" style={{ color: "var(--fg-secondary)" }}>Loading…</p>
      </div>
    );
  }

  const peer =
    conv.type === "direct"
      ? conv.participants.find((p) => p.user_id !== currentUser?.id)
      : null;

  const title =
    conv.type === "group"
      ? conv.title || `Group #${conv.id}`
      : peer?.username ?? `User #${conv.id}`;

  const avatarId = peer?.user_id ?? conv.id;
  const isOnline = peer ? onlineIds.has(peer.user_id) : false;
  const lastSeen = peer ? presence[peer.user_id]?.last_seen : null;

  const subtitle =
    conv.type === "group"
      ? `${conv.participants.length} members`
      : isOnline
      ? "Active now"
      : formatLastSeen(lastSeen);

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--messenger-chat-bg)" }}
    >
      {/* ── Header ── */}
      <header
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{
          borderColor: "var(--border)",
          background: "var(--messenger-header-bg)",
        }}
      >
        {/* Mobile back */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition md:hidden"
          style={{ color: "var(--fg)" }}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="flex h-[40px] w-[40px] items-center justify-center rounded-full text-[16px] font-bold text-white"
            style={{ background: avatarGrad(avatarId) }}
          >
            {title.charAt(0).toUpperCase()}
          </div>
          {isOnline && (
            <span
              className="absolute bottom-0 right-0 h-[12px] w-[12px] rounded-full border-2"
              style={{ background: "var(--online)", borderColor: "var(--messenger-header-bg)" }}
            />
          )}
        </div>

        {/* Name + status */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold" style={{ color: "var(--fg)" }}>
            {title}
          </p>
          <p
            className="text-[12px]"
            style={{ color: isOnline ? "var(--online)" : "var(--fg-secondary)" }}
          >
            {subtitle}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          {[
            { Icon: PhoneIcon, label: "Voice call" },
            { Icon: VideoCameraIcon, label: "Video call" },
            { Icon: InformationCircleIcon, label: "Conversation info" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              title={label}
              className="flex h-9 w-9 items-center justify-center rounded-full transition"
              style={{ color: "var(--blue)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </header>

      {/* ── Messages ── */}
      <MessageList
        conversationId={conversationId}
        onScrollToTop={() => {}}
        onRequestEdit={(msg) => setEditingMsg(msg)}
      />

      {/* ── Input ── */}
      <MessageInput
        conversationId={conversationId}
        editingMessage={editingMsg}
        onCancelEditing={() => setEditingMsg(null)}
      />
    </div>
  );
}

function MessengerLogo({ size }: { size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full shadow-lg"
      style={{ width: size, height: size, background: "var(--blue)" }}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        <path
          d="M24 4C13 4 4 12.5 4 23c0 5.8 2.7 11 7 14.6V44l6.3-3.5C19.1 41.1 21.5 41.5 24 41.5c11 0 20-8.5 20-18.5S35 4 24 4z"
          fill="#fff"
        />
        <path
          d="M11.5 29l7-7.5 3.5 3.5 6.5-7 7 7.5-6.5 7-3.5-3.5L11.5 29z"
          fill="var(--blue)"
        />
      </svg>
    </div>
  );
}
