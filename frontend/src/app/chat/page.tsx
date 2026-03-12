"use client";

import { useEffect } from "react";

import { ChatLayout } from "@/components/layout/ChatLayout";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";

export default function ChatPage(): JSX.Element {
  const setActiveConversationId = useConversationStore((state) => state.setActiveConversationId);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);

  useEffect(() => {
    setActiveConversationId(null);
    setMobileSidebarOpen(true);
  }, [setActiveConversationId, setMobileSidebarOpen]);

  return <ChatLayout />;
}
