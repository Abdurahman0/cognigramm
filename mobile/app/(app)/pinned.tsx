import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ChatListItem } from "@/components/chat";
import { AppButton, EmptyState, ScreenContainer, SectionHeader } from "@/components/common";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

export default function PinnedChatsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { chats, messagesByChat, togglePin } = useChatStore(useShallow((state) => ({
    chats: state.chats.filter((chat) => chat.pinned && !chat.archived),
    messagesByChat: state.messagesByChat,
    togglePin: state.togglePin
  })));

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="Pinned Chats"
          subtitle="Priority conversations"
          rightSlot={<AppButton label="Back" fullWidth={false} variant="ghost" onPress={() => router.back()} />}
        />
      </View>
      <View style={styles.content}>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<EmptyState title="Nothing pinned" description="Pin critical chats for faster navigation." />}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <ChatListItem
                chat={item}
                lastMessage={(messagesByChat[item.id] ?? []).slice(-1)[0]}
                onPress={() => router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId: item.id } })}
              />
              <Pressable onPress={() => togglePin(item.id)} style={styles.pinBtn}>
                <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "600" }}>Unpin</Text>
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
  pinBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4
  }
});
