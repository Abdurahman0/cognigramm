"use client";

import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";

import { messagesApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { useMessageStore } from "@/store/messageStore";
import type { Message } from "@/types/message";
import { MESSAGE_PAGE_LIMIT } from "@/utils/constants";

export function useMessages(conversationId: number | null): {
  messages: Message[];
  hasNextPage: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<void>;
  editMessage: (messageId: number, content: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
} {
  const setConversationMessages = useMessageStore((state) => state.setConversationMessages);
  const prependOlderMessages = useMessageStore((state) => state.prependOlderMessages);
  const byConversation = useMessageStore((state) => state.byConversation);
  const upsertMessage = useMessageStore((state) => state.upsertMessage);
  const removeMessage = useMessageStore((state) => state.removeMessage);

  const infiniteQuery = useInfiniteQuery({
    queryKey: conversationId ? queryKeys.messages(conversationId) : ["messages", "idle"],
    queryFn: ({ pageParam }) => {
      if (!conversationId) {
        return Promise.resolve([]);
      }
      return messagesApi.listByConversation(conversationId, MESSAGE_PAGE_LIMIT, pageParam as number);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < MESSAGE_PAGE_LIMIT) {
        return undefined;
      }
      return allPages.flat().length;
    },
    enabled: Boolean(conversationId)
  });

  useEffect(() => {
    if (!conversationId || !infiniteQuery.data) {
      return;
    }
    const pages = infiniteQuery.data.pages;
    if (!pages.length) {
      return;
    }
    const firstPage = pages[0];
    setConversationMessages(conversationId, firstPage);
    for (let index = 1; index < pages.length; index += 1) {
      prependOlderMessages(conversationId, pages[index]);
    }
  }, [conversationId, infiniteQuery.data, prependOlderMessages, setConversationMessages]);

  const editMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      const edited = await messagesApi.editMessage(messageId, content);
      if (conversationId) {
        upsertMessage(conversationId, edited);
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const deleted = await messagesApi.deleteMessage(messageId);
      if (conversationId) {
        upsertMessage(conversationId, deleted);
      }
    }
  });

  const messages = useMemo(() => {
    if (!conversationId) {
      return [];
    }
    return byConversation[conversationId] || [];
  }, [byConversation, conversationId]);

  return {
    messages,
    hasNextPage: Boolean(infiniteQuery.hasNextPage),
    isLoading: infiniteQuery.isLoading,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    fetchNextPage: async () => {
      if (infiniteQuery.hasNextPage) {
        await infiniteQuery.fetchNextPage();
      }
    },
    editMessage: async (messageId, content) => {
      await editMutation.mutateAsync({ messageId, content });
    },
    deleteMessage: async (messageId) => {
      await deleteMutation.mutateAsync(messageId);
      if (conversationId) {
        removeMessage(conversationId, messageId);
      }
    }
  };
}
