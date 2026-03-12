"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { conversationsApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { useConversationStore } from "@/store/conversationStore";

export function useConversations(): {
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => void;
} {
  const setConversations = useConversationStore((state) => state.setConversations);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => conversationsApi.list(200, 0)
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
