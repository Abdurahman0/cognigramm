import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkspacePane } from "@/components/layout";
import { EmptyState } from "@/components/common";
import { ChatListPane } from "@/features/chat/ChatListPane";
import { ConversationPanel } from "@/features/chat/ConversationPanel";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

export default function ChatsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();

  const { activeDesktopChatId, setActiveConversationId, setDesktopChat } = useChatStore(
    useShallow((state) => ({
      activeDesktopChatId: state.activeDesktopChatId,
      setActiveConversationId: state.setActiveConversationId,
      setDesktopChat: state.setActiveDesktopChatId
    }))
  );

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    if (activeDesktopChatId) {
      setActiveConversationId(activeDesktopChatId);
    }
    return () => {
      if (activeDesktopChatId) {
        setActiveConversationId("");
      }
    };
  }, [activeDesktopChatId, isDesktop, setActiveConversationId]);

  const openChat = (chatId: string) => {
    if (isDesktop) {
      setDesktopChat(chatId);
      return;
    }
    router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId } });
  };

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <WorkspacePane width={theme.layout.listPaneWidth}>
          <ChatListPane activeChatId={activeDesktopChatId} onSelectChat={openChat} />
        </WorkspacePane>
        <WorkspacePane>
          {activeDesktopChatId ? (
            <ConversationPanel chatId={activeDesktopChatId} />
          ) : (
            <View style={styles.emptyPane}>
              <EmptyState
                title="Select a conversation"
                description="Pick a chat from the list to open the thread, or start a new one."
                icon="message-square"
              />
            </View>
          )}
        </WorkspacePane>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.mobileRoot}>
      <ChatListPane onSelectChat={openChat} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    backgroundColor: "transparent",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0
  },
  mobileRoot: {
    backgroundColor: "transparent",
    flex: 1
  },
  emptyPane: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28
  }
});
