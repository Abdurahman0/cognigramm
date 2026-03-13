import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ChatListItem } from "@/components/chat";
import { AppButton, EmptyState, ScreenContainer, SectionHeader } from "@/components/common";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

export default function ArchivedChatsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { chats, messagesByChat, toggleArchive } = useChatStore(useShallow((state) => ({
    chats: state.chats.filter((chat) => chat.archived),
    messagesByChat: state.messagesByChat,
    toggleArchive: state.toggleArchive
  })));

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="Archived Chats"
          subtitle="Muted from main inbox"
          rightSlot={<AppButton label="Back" fullWidth={false} variant="ghost" onPress={() => router.back()} />}
        />
      </View>
      <View style={styles.content}>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState title="No archived chats" description="Archive conversations to declutter active workstreams." />
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <ChatListItem
                chat={item}
                lastMessage={(messagesByChat[item.id] ?? []).slice(-1)[0]}
                onPress={() => router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId: item.id } })}
              />
              <Pressable onPress={() => toggleArchive(item.id)} style={styles.unarchiveBtn}>
                <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "600" }}>Unarchive</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  rowWrap: {
    gap: 6
  },
  unarchiveBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4
  }
});
