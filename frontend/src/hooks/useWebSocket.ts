"use client";

import { useEffect, useMemo, useRef } from "react";

import { useAuthStore } from "@/store/authStore";
import { useConversationStore } from "@/store/conversationStore";
import { useWebSocketStore } from "@/store/websocketStore";
import { realtimeSocketClient } from "@/websocket/socketClient";

function buildSessionId(): string {
  if (typeof window === "undefined") {
    return "session-server";
  }
  const fromStorage = sessionStorage.getItem("messenger_ws_session_id");
  if (fromStorage) {
    return fromStorage;
  }
  const next = crypto.randomUUID();
  sessionStorage.setItem("messenger_ws_session_id", next);
  return next;
}

export function useWebSocket(): void {
  const { accessToken, isAuthenticated } = useAuthStore();
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const conversations = useConversationStore((state) => state.conversations);
  const setStatus = useWebSocketStore((state) => state.setStatus);
  const sessionId = useMemo(buildSessionId, []);
  const activeConversationIdRef = useRef<number | null>(activeConversationId);
  const joinedRoomsRef = useRef(new Set<number>());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      realtimeSocketClient.disconnect();
      setStatus("disconnected");
      return;
    }
    setStatus("connecting");
    realtimeSocketClient.connect({
      token: accessToken,
      sessionId,
      deviceId: "web"
    });
    const unsubscribe = realtimeSocketClient.subscribe((event) => {
      if (event.event === "connected") {
        setStatus("connected");
        joinedRoomsRef.current = new Set();
        const currentConversationId = activeConversationIdRef.current;
        realtimeSocketClient.send("active_conversation", { conversation_id: currentConversationId });
      }
      if (event.event === "error") {
        setStatus("error");
      }
    });
    return () => {
      unsubscribe();
      realtimeSocketClient.disconnect();
      setStatus("disconnected");
    };
  }, [accessToken, isAuthenticated, sessionId, setStatus]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    realtimeSocketClient.send("active_conversation", { conversation_id: activeConversationId });
  }, [activeConversationId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      joinedRoomsRef.current = new Set();
      return;
    }
    for (const conversation of conversations) {
      if (joinedRoomsRef.current.has(conversation.id)) {
        continue;
      }
      realtimeSocketClient.send("join_conversation", { conversation_id: conversation.id });
      joinedRoomsRef.current.add(conversation.id);
    }
  }, [conversations, isAuthenticated]);
}
