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

interface MessageListProps {
  conversationId: number | null;
  onScrollToTop: () => void;
  onRequestEdit: (message: Message) => void;
}

type ListDateItem = { kind: "date"; key: string; date: string };
type ListMessageItem = { kind: "message"; key: string; message: Message };
type MessageListItem = ListDateItem | ListMessageItem;

export function MessageList({ conversationId, onScrollToTop, onRequestEdit }: MessageListProps): JSX.Element {
  const { messages, hasNextPage, isLoading, isFetchingNextPage, fetchNextPage } = useMessages(conversationId);
  const currentUser = useUserStore((state) => state.currentUser);
  const typingByConversation = usePresenceStore((state) => state.typingByConversation);
  const updateMessageDelivery = useMessageStore((state) => state.updateMessageDelivery);
  const [deletingMessage, setDeletingMessage] = useState<Message | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const readMarkedIdsRef = useRef(new Set<number>());
  const shouldStickToBottomRef = useRef(true);
  const previousConversationRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);

  const conversation = useConversationStore((state) =>
    conversationId ? state.conversationsById[conversationId] : null
  );
  const isGroupConversation = conversation?.type === "group";

  const listItems = useMemo<MessageListItem[]>(() => {
    const items: MessageListItem[] = [];
    let lastDate: string | null = null;
    for (const message of messages) {
      const messageDate = formatMessageDate(message.created_at);
      if (messageDate !== lastDate) {
        items.push({ kind: "date", key: `date-${messageDate}-${message.id}`, date: messageDate });
        lastDate = messageDate;
      }
      items.push({ kind: "message", key: `message-${message.id}-${message.client_message_id}`, message });
    }
    return items;
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10
  });

  const onScroll = useCallback(() => {
    if (!parentRef.current) return;
    const element = parentRef.current;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom < 140;

    if (element.scrollTop > 140 || loadingOlderRef.current || !hasNextPage || isFetchingNextPage) return;

    loadingOlderRef.current = true;
    const previousHeight = element.scrollHeight;
    fetchNextPage()
      .then(() => {
        requestAnimationFrame(() => {
          if (!parentRef.current) return;
          const heightDiff = parentRef.current.scrollHeight - previousHeight;
          parentRef.current.scrollTop += heightDiff;
          onScrollToTop();
        });
      })
      .finally(() => { loadingOlderRef.current = false; });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, onScrollToTop]);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  useEffect(() => {
    if (previousConversationRef.current !== conversationId) {
      previousConversationRef.current = conversationId;
      previousMessageCountRef.current = 0;
      readMarkedIdsRef.current = new Set<number>();
      requestAnimationFrame(() => {
        if (parentRef.current) parentRef.current.scrollTop = parentRef.current.scrollHeight;
      });
      return;
    }
    if (messages.length <= previousMessageCountRef.current) return;
    previousMessageCountRef.current = messages.length;
    if (shouldStickToBottomRef.current) {
      requestAnimationFrame(() => {
        if (parentRef.current) parentRef.current.scrollTop = parentRef.current.scrollHeight;
      });
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (!conversationId || !currentUser || messages.length === 0) return;
    const unreadMessages = messages.filter(
      (message) =>
        message.id > 0 &&
        message.sender_id !== currentUser.id &&
        message.delivery_state !== "read" &&
        !readMarkedIdsRef.current.has(message.id)
    );
    if (unreadMessages.length === 0) return;
    for (const message of unreadMessages) {
      readMarkedIdsRef.current.add(message.id);
      updateMessageDelivery(conversationId, message.id, { state: "read", read_at: new Date().toISOString() });
      messagesApi.markRead(message.id).catch(() => undefined);
      realtimeSocketClient.send("read_receipt", { message_id: message.id });
    }
  }, [conversationId, currentUser, messages, updateMessageDelivery]);

  const typingUserIds = conversationId ? typingByConversation[conversationId] || new Set<number>() : new Set<number>();
  const typingUsernames = Array.from(typingUserIds)
    .filter((userId) => userId !== currentUser?.id)
    .map((userId) => {
      const participant = conversation?.participants.find((member) => member.user_id === userId);
      return participant?.username || `User ${userId}`;
    });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingState label="Loading messages..." />
      </div>
    );
  }

  if (!conversationId) {
    return (
      <EmptyState title="No conversation selected" description="Choose a conversation to start messaging." />
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <EmptyState title="No messages yet" description="Be the first to say something!" />
        <TypingIndicator usernames={typingUsernames} />
      </div>
    );
  }

  return (
    <>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto py-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
      >
        {isFetchingNextPage ? (
          <div className="px-4 pt-2">
            <LoadingState className="py-2" label="Loading older messages..." />
          </div>
        ) : null}
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = listItems[virtualRow.index];
            if (!item) return null;

            if (item.kind === "date") {
              return (
                <div
                  key={item.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className="flex items-center justify-center py-3"
                >
                  <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium text-[var(--muted)]">
                    {item.date}
                  </span>
                </div>
              );
            }

            const message = item.message;
            const isOwn = message.sender_id === currentUser?.id;
            const senderName = message.sender?.username || null;

            return (
              <div
                key={item.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <MessageBubble
                  message={message}
                  isOwn={Boolean(isOwn)}
                  showSenderName={Boolean(!isOwn && isGroupConversation)}
                  senderName={senderName}
                  onEdit={isOwn ? () => onRequestEdit(message) : undefined}
                  onDelete={isOwn ? () => setDeletingMessage(message) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
      <TypingIndicator usernames={typingUsernames} />
      <MessageDeleteDialog message={deletingMessage} onClose={() => setDeletingMessage(null)} />
    </>
  );
}
