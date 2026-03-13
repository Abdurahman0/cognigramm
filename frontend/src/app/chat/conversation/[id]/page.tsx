"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { ChatLayout } from "@/components/layout/ChatLayout";
import { useMessages } from "@/hooks/useMessages";
import { conversationsApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { realtimeSocketClient } from "@/websocket/socketClient";

export default function ConversationPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const setActiveConversationId = useConversationStore((state) => state.setActiveConversationId);
  const upsertConversation = useConversationStore((state) => state.upsertConversation);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);

  const conversationId = useMemo(() => {
    const rawId = params?.id;
    if (!rawId) {
      return null;
    }
    const parsed = Number.parseInt(rawId, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [params]);

  useMessages(conversationId);

  const conversationQuery = useQuery({
    queryKey: conversationId ? queryKeys.conversation(conversationId) : ["conversations", "invalid"],
    queryFn: () => conversationsApi.getById(conversationId as number),
    enabled: Boolean(conversationId),
    retry: 1
  });

  useEffect(() => {
    if (!conversationId) {
      router.replace("/chat");
      return;
    }
    setActiveConversationId(conversationId);
    setMobileSidebarOpen(false);
  }, [conversationId, router, setActiveConversationId, setMobileSidebarOpen]);

  useEffect(() => {
    if (!conversationQuery.data) {
      return;
    }
    upsertConversation(conversationQuery.data);
  }, [conversationQuery.data, upsertConversation]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    realtimeSocketClient.send("join_conversation", { conversation_id: conversationId });
  }, [conversationId]);

  useEffect(() => {
    if (!conversationQuery.isError) {
      return;
    }
    router.replace("/chat");
  }, [conversationQuery.isError, router]);

  return <ChatLayout />;
}
