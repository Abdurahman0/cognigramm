"use client";

import { useMemo, useState } from "react";
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConversationItem } from "@/components/chat/ConversationItem";
import { LoadingState } from "@/components/common/LoadingState";
import { CreateConversationDialog } from "@/features/conversations/CreateConversationDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { conversationsApi } from "@/services/api";
import { useConversationStore } from "@/store/conversationStore";
import { useMessageStore } from "@/store/messageStore";
import { useUIStore } from "@/store/uiStore";
import { useUserStore } from "@/store/userStore";
import type { Conversation } from "@/types/conversation";
import type { Message } from "@/types/message";
import { cn } from "@/utils/cn";

function previewOf(msg: Message | undefined): string {
  if (!msg) return "No messages yet";
  if (msg.deleted_at) return "Message deleted";
  if (msg.content?.trim()) return msg.content.trim();
  if (msg.message_type === "image") return "📷 Photo";
  if (msg.message_type === "voice") return "🎤 Voice message";
  if (msg.message_type === "file") return "📎 File";
  return "Message";
}

/** Find an existing direct conversation with targetUserId (without needing currentUser). */
function findDirectWith(conversations: Conversation[], targetUserId: number): Conversation | undefined {
  return conversations.find(
    (c) =>
      c.type === "direct" &&
      c.participants.length === 2 &&
      c.participants.some((p) => p.user_id === targetUserId)
  );
}

interface ConversationListProps {
  loading: boolean;
}

export function ConversationList({ loading }: ConversationListProps): JSX.Element {
  const router = useRouter();
  const conversations = useConversationStore((s) => s.conversations);
  const activeId = useConversationStore((s) => s.activeConversationId);
  const setActiveId = useConversationStore((s) => s.setActiveConversationId);
  const upsertConversation = useConversationStore((s) => s.upsertConversation);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const currentUser = useUserStore((s) => s.currentUser);
  const byConversation = useMessageStore((s) => s.byConversation);

  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const debQuery = useDebouncedValue(query.trim().toLowerCase(), 180);

  /* ── open existing conversation ── */
  const openConv = (id: number) => {
    setActiveId(id);
    setMobileSidebarOpen(false);
    router.push(`/chat/conversation/${id}`);
  };

  /* ── create/find direct conversation ── */
  const createMutation = useMutation({
    mutationFn: (targetUserId: number) =>
      conversationsApi.create({ type: "direct", participant_ids: [targetUserId] }),
    onSuccess: (conv) => {
      upsertConversation(conv);
      openConv(conv.id);
    },
    onError: () => toast.error("Could not open chat"),
  });

  /* ── Sort conversations by last message ── */
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const msgsA = byConversation[a.id] ?? [];
      const msgsB = byConversation[b.id] ?? [];
      const tsA = msgsA[msgsA.length - 1]?.created_at ?? a.created_at;
      const tsB = msgsB[msgsB.length - 1]?.created_at ?? b.created_at;
      return tsA < tsB ? 1 : tsA > tsB ? -1 : b.id - a.id;
    });
  }, [conversations, byConversation]);

  /* ── Filter by search query ── */
  const filtered = useMemo(() => {
    if (!debQuery) return sorted;
    return sorted.filter((c) => {
      const title = c.title || "";
      const names = c.participants.map((p) => p.username).join(" ");
      return `${title} ${names}`.toLowerCase().includes(debQuery);
    });
  }, [sorted, debQuery]);

  return (
    <aside className="flex h-full flex-col" style={{ background: "var(--messenger-sidebar-bg)" }}>

      {/* ── Header ── */}
      <header className="px-4 pb-1 pt-4 shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[24px] font-bold leading-none" style={{ color: "var(--fg)" }}>
            Chats
          </h1>
          <div className="flex items-center gap-1">
            <IconBtn onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark"
                ? <SunIcon className="h-[18px] w-[18px]" />
                : <MoonIcon className="h-[18px] w-[18px]" />}
            </IconBtn>
            <IconBtn onClick={() => setDialogOpen(true)} title="New message">
              <PencilSquareIcon className="h-[18px] w-[18px]" />
            </IconBtn>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2"
            style={{ color: "var(--fg-secondary)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Messenger"
            className="h-[36px] w-full rounded-full pl-9 pr-3 text-[15px] outline-none"
            style={{
              background: "var(--surface)",
              color: "var(--fg)",
            }}
          />
        </div>
      </header>

      {/* ── Conversation list ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {loading && <LoadingState />}

        {!loading && filtered.length === 0 && (
          <p className="px-3 py-3 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
            {query ? "No results found." : "No conversations yet. Create one!"}
          </p>
        )}

        {!loading &&
          filtered.map((conv) => {
            const msgs = byConversation[conv.id] ?? [];
            const lastMsg = msgs[msgs.length - 1];
            const unread =
              activeId === conv.id
                ? 0
                : msgs.filter(
                    (m) =>
                      m.sender_id !== currentUser?.id &&
                      !m.deleted_at &&
                      m.delivery_state !== "read"
                  ).length;
            return (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                active={activeId === conv.id}
                currentUserId={currentUser?.id}
                previewText={previewOf(lastMsg)}
                previewTime={lastMsg?.created_at ?? null}
                unreadCount={unread}
                onClick={openConv}
              />
            );
          })}
      </div>

      {/* ── Create conversation dialog ── */}
      <CreateConversationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onOpenConversation={(conv) => {
          upsertConversation(conv);
          openConv(conv.id);
        }}
      />
    </aside>
  );
}

/* ── Helper: circular icon button ── */
function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
      style={{ background: "var(--surface)", color: "var(--fg)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface)")}
    >
      {children}
    </button>
  );
}
