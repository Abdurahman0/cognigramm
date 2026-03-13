import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, ScreenContainer, SearchBar, SectionHeader } from "@/components/common";
import { searchMessages } from "@/features/chat/selectors";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { formatRelative } from "@/utils/date";
import { useShallow } from "zustand/react/shallow";

export default function SearchScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { chats, messagesByChat, query, setQuery } = useChatStore(useShallow((state) => ({
    chats: state.chats,
    messagesByChat: state.messagesByChat,
    query: state.messageSearchQuery,
    setQuery: state.setMessageSearchQuery
  })));

  const rows = useMemo(() => searchMessages(chats, messagesByChat, query), [chats, messagesByChat, query]);

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="Search Messages"
          subtitle="Across chats, people, and channels"
          rightSlot={
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Feather name="x" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />
      </View>
      <View style={styles.content}>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Search messages" />

        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.chat.id}_${item.message.id}`}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No matching messages"
              description="Try searching by project name, keyword, or teammate."
              icon="search"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId: item.chat.id } })}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border
                }
              ]}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.chatName, { color: theme.colors.textPrimary }]}>{item.chat.title}</Text>
                <Text style={[styles.when, { color: theme.colors.textMuted }]}>{formatRelative(item.message.createdAt)}</Text>
              </View>
              <Text style={[styles.message, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                {item.message.body}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
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
  iconBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  content: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  chatName: {
    fontSize: 14,
    fontWeight: "700"
  },
  when: {
    fontSize: 11
  },
  message: {
    fontSize: 13,
    lineHeight: 18
  }
});
