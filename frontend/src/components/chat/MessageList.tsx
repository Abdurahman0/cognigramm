"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { MessageDeleteDialog } from "@/features/messages/MessageDeleteDialog";
import { useMessages } from "@/hooks/useMessages";
import { messagesApi } from "@/services/api";
import { useConversationStore } from "@/store/conversationStore";
import { useMessageStore } from "@/store/messageStore";
import { usePresenceStore } from "@/store/presenceStore";
import { useUserStore } from "@/store/userStore";
import type { Message } from "@/types/message";
import { formatMessageDate } from "@/utils/date";
import { realtimeSocketClient } from "@/websocket/socketClient";

interface Props {
  conversationId: number | null;
  onScrollToTop: () => void;
  onRequestEdit: (message: Message) => void;
}

type DateItem = { kind: "date"; key: string; date: string };
type MsgItem = { kind: "message"; key: string; message: Message };
type ListItem = DateItem | MsgItem;

export function MessageList({ conversationId, onScrollToTop, onRequestEdit }: Props): JSX.Element {
  const { messages, hasNextPage, isLoading, isFetchingNextPage, fetchNextPage } = useMessages(conversationId);
  const currentUser = useUserStore((s) => s.currentUser);
  const typingByConv = usePresenceStore((s) => s.typingByConversation);
  const updateDelivery = useMessageStore((s) => s.updateMessageDelivery);
  const [deletingMsg, setDeletingMsg] = useState<Message | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const readIds = useRef(new Set<number>());
  const stickBottom = useRef(true);
  const prevConvRef = useRef<number | null>(null);
  const prevCountRef = useRef(0);

  const conv = useConversationStore((s) =>
    conversationId ? s.conversationsById[conversationId] : null
  );
  const isGroup = conv?.type === "group";

  /* ── Build virtual list items ── */
  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    let lastDate: string | null = null;
    for (const msg of messages) {
      const d = formatMessageDate(msg.created_at);
      if (d !== lastDate) {
        out.push({ kind: "date", key: `d-${d}-${msg.id}`, date: d });
        lastDate = d;
      }
      out.push({ kind: "message", key: `m-${msg.id}-${msg.client_message_id}`, message: msg });
    }
    return out;
  }, [messages]);

  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  /* ── Scroll handler: load older messages ── */
  const onScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop > 100 || loadingOlderRef.current || !hasNextPage || isFetchingNextPage) return;
    loadingOlderRef.current = true;
    const prevH = el.scrollHeight;
    fetchNextPage()
      .then(() => {
        requestAnimationFrame(() => {
          if (!parentRef.current) return;
          parentRef.current.scrollTop += parentRef.current.scrollHeight - prevH;
          onScrollToTop();
        });
      })
      .finally(() => { loadingOlderRef.current = false; });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, onScrollToTop]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  /* ── Scroll to bottom on new messages / conversation switch ── */
  useEffect(() => {
    if (prevConvRef.current !== conversationId) {
      prevConvRef.current = conversationId;
      prevCountRef.current = 0;
      readIds.current = new Set();
      requestAnimationFrame(() => {
        if (parentRef.current) parentRef.current.scrollTop = parentRef.current.scrollHeight;
      });
      return;
    }
    if (messages.length <= prevCountRef.current) return;
    prevCountRef.current = messages.length;
    if (stickBottom.current) {
      requestAnimationFrame(() => {
        if (parentRef.current) parentRef.current.scrollTop = parentRef.current.scrollHeight;
      });
    }
  }, [conversationId, messages.length]);

  /* ── Mark messages as read ── */
  useEffect(() => {
    if (!conversationId || !currentUser || !messages.length) return;
    const unread = messages.filter(
      (m) => m.id > 0 && m.sender_id !== currentUser.id && m.delivery_state !== "read" && !readIds.current.has(m.id)
    );
    if (!unread.length) return;
    for (const m of unread) {
      readIds.current.add(m.id);
      updateDelivery(conversationId, m.id, { state: "read", read_at: new Date().toISOString() });
      messagesApi.markRead(m.id).catch(() => undefined);
      realtimeSocketClient.send("read_receipt", { message_id: m.id });
    }
  }, [conversationId, currentUser, messages, updateDelivery]);

  /* ── Typing usernames ── */
  const typingIds = conversationId ? typingByConv[conversationId] ?? new Set<number>() : new Set<number>();
  const typingNames = Array.from(typingIds)
    .filter((id) => id !== currentUser?.id)
    .map((id) => conv?.participants.find((p) => p.user_id === id)?.username ?? `User ${id}`);

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingState label="Loading messages…" />
      </div>
    );
  }

  if (!conversationId) {
    return <EmptyState title="No conversation selected" description="Choose a conversation to start." />;
  }

  if (!messages.length) {
    return (
      <div className="flex flex-1 flex-col">
        <EmptyState title="No messages yet" description="Say hello!" />
        <TypingIndicator usernames={typingNames} />
      </div>
    );
  }

  return (
    <>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto py-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {isFetchingNextPage && (
          <div className="px-4 pt-2">
            <LoadingState className="py-1" label="Loading older messages…" />
          </div>
        )}
        <div style={{ height: `${virt.getTotalSize()}px`, position: "relative" }}>
          {virt.getVirtualItems().map((row) => {
            const item = items[row.index];
            if (!item) return null;

            if (item.kind === "date") {
              return (
                <div
                  key={item.key}
                  data-index={row.index}
                  ref={virt.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)` }}
                  className="flex items-center justify-center py-3"
                >
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-medium"
                    style={{ background: "var(--surface)", color: "var(--fg-secondary)" }}
                  >
                    {item.date}
                  </span>
                </div>
              );
            }

            const msg = item.message;
            const isOwn = msg.sender_id === currentUser?.id;
            return (
              <div
                key={item.key}
                data-index={row.index}
                ref={virt.measureElement}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)` }}
              >
                <MessageBubble
                  message={msg}
                  isOwn={Boolean(isOwn)}
                  showSenderName={Boolean(!isOwn && isGroup)}
                  senderName={msg.sender?.username ?? null}
                  onEdit={isOwn ? () => onRequestEdit(msg) : undefined}
                  onDelete={isOwn ? () => setDeletingMsg(msg) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
      <TypingIndicator usernames={typingNames} />
      <MessageDeleteDialog message={deletingMsg} onClose={() => setDeletingMsg(null)} />
    </>
  );
}
