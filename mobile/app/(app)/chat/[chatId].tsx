import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppShell, WorkspacePane } from "@/components/layout";
import { ChatListPane } from "@/features/chat/ChatListPane";
import { ConversationPanel } from "@/features/chat/ConversationPanel";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useChatStore } from "@/store/chatStore";

export default function ChatDetailsScreen(): JSX.Element {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();
  const setDesktopChat = useChatStore((state) => state.setActiveDesktopChatId);

  if (!chatId) {
    return <View style={styles.blank} />;
  }

  if (isDesktop) {
    return (
      <AppShell>
        <View style={styles.desktopRoot}>
          <WorkspacePane width={theme.layout.listPaneWidth}>
            <ChatListPane
              activeChatId={chatId}
              onSelectChat={(nextChatId) => {
                setDesktopChat(nextChatId);
                router.replace("/(app)/(tabs)/chats");
              }}
            />
          </WorkspacePane>
          <WorkspacePane>
            <ConversationPanel chatId={chatId} />
          </WorkspacePane>
        </View>
      </AppShell>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.mobileRoot}>
      <ConversationPanel chatId={chatId} compact />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  blank: {
    backgroundColor: "transparent",
    flex: 1
  },
  mobileRoot: {
    backgroundColor: "transparent",
    flex: 1
  },
  desktopRoot: {
    backgroundColor: "transparent",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0
  }
});
