"use client";

import { useMemo, useState } from "react";
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  SunIcon,
  MoonIcon
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConversationItem } from "@/components/chat/ConversationItem";
import { LoadingState } from "@/components/common/LoadingState";
import { CreateConversationDialog } from "@/features/conversations/CreateConversationDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { conversationsApi, usersApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { useConversationStore } from "@/store/conversationStore";
import { useMessageStore } from "@/store/messageStore";
import { usePresenceStore } from "@/store/presenceStore";
import { useUIStore } from "@/store/uiStore";
import { useUserStore } from "@/store/userStore";
import type { Conversation } from "@/types/conversation";
import type { Message } from "@/types/message";
import type { User } from "@/types/user";
import { cn } from "@/utils/cn";

function resolvePreview(message: Message | undefined): string {
  if (!message) {
    return "No messages yet";
  }
  if (message.deleted_at) {
    return "Message deleted";
  }
  if (message.content && message.content.trim()) {
    return message.content.trim();
  }
  if (message.message_type === "image") {
    return "📷 Photo";
  }
  if (message.message_type === "voice") {
    return "🎤 Voice message";
  }
  if (message.message_type === "file") {
    return "📎 File";
  }
  return "Message";
}

interface ConversationListProps {
  loading: boolean;
}

export function ConversationList({ loading }: ConversationListProps): JSX.Element {
  const router = useRouter();
  const conversations = useConversationStore((state) => state.conversations);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const setActiveConversationId = useConversationStore((state) => state.setActiveConversationId);
  const upsertConversation = useConversationStore((state) => state.upsertConversation);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const currentUser = useUserStore((state) => state.currentUser);
  const messagesByConversation = useMessageStore((state) => state.byConversation);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "people">("chats");
  const debouncedQuery = useDebouncedValue(query.trim().toLowerCase(), 200);

  const usersQuery = useQuery({
    queryKey: queryKeys.searchUsers("__all__"),
    queryFn: () => usersApi.search({ limit: 500, offset: 0, includeSelf: false }),
    staleTime: 60_000
  });

  const createDirectMutation = useMutation({
    mutationFn: async (user: User) =>
      conversationsApi.create({
        type: "direct",
        participant_ids: [user.id]
      }),
    onSuccess: (conversation) => {
      upsertConversation(conversation);
      setActiveConversationId(conversation.id);
      setMobileSidebarOpen(false);
      router.push(`/chat/conversation/${conversation.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to open chat");
    }
  });

  const sortedConversations = useMemo(() => {
    const list = [...conversations];
    list.sort((left, right) => {
      const leftLast = messagesByConversation[left.id]?.[messagesByConversation[left.id].length - 1];
      const rightLast = messagesByConversation[right.id]?.[messagesByConversation[right.id].length - 1];
      const leftTs = leftLast?.created_at || left.created_at;
      const rightTs = rightLast?.created_at || right.created_at;
      if (leftTs === rightTs) {
        return right.id - left.id;
      }
      return leftTs < rightTs ? 1 : -1;
    });
    return list;
  }, [conversations, messagesByConversation]);

  const chatsFiltered = useMemo(() => {
    if (!debouncedQuery) {
      return sortedConversations;
    }
    return sortedConversations.filter((conversation) => {
      const title = conversation.title || "";
      const members = conversation.participants.map((participant) => participant.username).join(" ");
      return `${title} ${members}`.toLowerCase().includes(debouncedQuery);
    });
  }, [debouncedQuery, sortedConversations]);

  const usersFiltered = useMemo(() => {
    const items = usersQuery.data ?? [];
    if (!debouncedQuery) {
      return items;
    }
    return items.filter((user) => `${user.username} ${user.email}`.toLowerCase().includes(debouncedQuery));
  }, [debouncedQuery, usersQuery.data]);

  const findDirectConversation = (targetUserId: number): Conversation | undefined =>
    conversations.find(
      (conversation) =>
        conversation.type === "direct" &&
        conversation.participants.some((participant) => participant.user_id === targetUserId) &&
        conversation.participants.some((participant) => participant.user_id === currentUser?.id)
    );

  const openConversation = (conversationId: number) => {
    setActiveConversationId(conversationId);
    setMobileSidebarOpen(false);
    router.push(`/chat/conversation/${conversationId}`);
  };

  const handleUserClick = (user: User) => {
    const existingConversation = findDirectConversation(user.id);
    if (existingConversation) {
      openConversation(existingConversation.id);
      return;
    }
    createDirectMutation.mutate(user);
  };

  return (
    <aside className="flex h-full flex-col bg-[var(--messenger-sidebar-bg)]">
      {/* Header */}
      <header className="px-4 pb-2 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[24px] font-bold text-[var(--foreground)]">Chats</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--foreground)] transition hover:bg-[var(--messenger-hover)]"
            >
              {theme === "dark" ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              title="New message"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--foreground)] transition hover:bg-[var(--messenger-hover)]"
            >
              <PencilSquareIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Messenger"
            className="h-[36px] w-full rounded-full bg-[var(--secondary)] pl-9 pr-3 text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
              activeTab === "chats"
                ? "bg-[var(--messenger-active)] text-[var(--primary)]"
                : "text-[var(--muted)] hover:bg-[var(--messenger-hover)]"
            )}
          >
            Chats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("people")}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
              activeTab === "people"
                ? "bg-[var(--messenger-active)] text-[var(--primary)]"
                : "text-[var(--muted)] hover:bg-[var(--messenger-hover)]"
            )}
          >
            People
          </button>
        </div>
      </header>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {activeTab === "chats" ? (
          <div>
            {loading ? <LoadingState /> : null}
            {!loading && chatsFiltered.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-[var(--muted)]">No conversations found.</p>
            ) : null}
            {!loading &&
              chatsFiltered.map((conversation) => {
                const items = messagesByConversation[conversation.id] || [];
                const lastMessage = items[items.length - 1];
                const unreadCount =
                  activeConversationId === conversation.id
                    ? 0
                    : items.filter(
                        (message) =>
                          message.sender_id !== currentUser?.id && !message.deleted_at && message.delivery_state !== "read"
                      ).length;
                return (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    active={activeConversationId === conversation.id}
                    currentUserId={currentUser?.id}
                    previewText={resolvePreview(lastMessage)}
                    previewTime={lastMessage?.created_at || null}
                    unreadCount={unreadCount}
                    onClick={openConversation}
                  />
                );
              })}
          </div>
        ) : (
          <div>
            {usersQuery.isLoading ? <LoadingState /> : null}
            {!usersQuery.isLoading && usersFiltered.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-[var(--muted)]">No users found.</p>
            ) : null}
            {usersFiltered.map((user) => {
              const hasConversation = Boolean(findDirectConversation(user.id));
              const isOnline = onlineUserIds.has(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleUserClick(user)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--messenger-hover)]"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-gradient-to-br from-[#a0aec0] to-[#718096] text-xl font-bold text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--messenger-sidebar-bg)] bg-[var(--messenger-online)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[15px] font-semibold text-[var(--foreground)]">{user.username}</span>
                      <span className="ml-2 shrink-0 text-[12px] text-[var(--primary)]">{hasConversation ? "Open" : "Message"}</span>
                    </div>
                    <p className="truncate text-[13px] text-[var(--muted)]">{isOnline ? "Active now" : user.email}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateConversationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </aside>
  );
}
