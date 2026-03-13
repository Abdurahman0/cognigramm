"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { conversationsApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { useConversationStore } from "@/store/conversationStore";

const CONVERSATIONS_PAGE_LIMIT = 100;
const CONVERSATIONS_MAX_FETCH = 5000;

async function listAllConversations(): Promise<Awaited<ReturnType<typeof conversationsApi.list>>> {
  const all = [];
  let offset = 0;

  while (offset < CONVERSATIONS_MAX_FETCH) {
    const page = await conversationsApi.list(CONVERSATIONS_PAGE_LIMIT, offset);
    if (!page.length) {
      break;
    }
    all.push(...page);
    if (page.length < CONVERSATIONS_PAGE_LIMIT) {
      break;
    }
    offset += page.length;
  }

  const unique = new Map<number, (typeof all)[number]>();
  for (const conversation of all) {
    unique.set(conversation.id, conversation);
  }
  return Array.from(unique.values());
}

export function useConversations(): {
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => void;
} {
  const setConversations = useConversationStore((state) => state.setConversations);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: listAllConversations
  });

  useEffect(() => {
    if (data) {
      setConversations(data);
    }
  }, [data, setConversations]);

  return {
    isLoading,
    isFetching,
    error: error instanceof Error ? error.message : null,
    refetch: () => {
      refetch().catch(() => undefined);
    }
  };
}
