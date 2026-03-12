"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationList } from "@/components/chat/ConversationList";
import { useConversations } from "@/hooks/useConversations";
import { usePresencePolling } from "@/hooks/usePresence";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";

export function ChatLayout(): JSX.Element {
  const { isLoading } = useConversations();
  usePresencePolling();
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const showSidebar = mobileSidebarOpen || !activeConversationId;

  const handleSidebarClose = () => {
    useUIStore.getState().setMobileSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 w-full flex-col border-r border-[var(--border)] bg-[var(--messenger-sidebar-bg)] transition-transform duration-300 md:relative md:w-[360px] md:translate-x-0",
          showSidebar ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <ConversationList loading={isLoading} />
      </aside>

      {showSidebar && activeConversationId && (
        <div
          onClick={handleSidebarClose}
          className="fixed inset-0 z-10 bg-black/20 md:hidden"
        />
      )}

      <main className="flex-1 overflow-hidden">
        <ChatWindow conversationId={activeConversationId} />
      </main>
    </div>
  );
}
