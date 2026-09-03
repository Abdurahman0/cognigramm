import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { ChatListItem } from "@/components/chat";
import { EmptyState, LoadingSkeleton, SearchBar, SectionHeader } from "@/components/common";
import { Chip, IconButton } from "@/components/ui";
import { CHAT_FILTERS } from "@/constants/chat";
import { PresenceRail } from "@/features/chat/PresenceRail";
import { filterChats } from "@/features/chat/selectors";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore, type ChatFilterKey } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

interface ChatListPaneProps {
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  /** Hidden when the surrounding screen already renders its own title row. */
  showHeader?: boolean;
}

/** Search + presence + filtered conversation list. Shared by the chats and call screens. */
export function ChatListPane({
  activeChatId,
  onSelectChat,
  showHeader = true
}: ChatListPaneProps): JSX.Element {
  const { theme } = useAppTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    chats,
    messagesByChat,
    filter,
    searchQuery,
    setFilter,
    setSearchQuery,
    refreshChats
  } = useChatStore(
    useShallow((state) => ({
      chats: state.chats,
      messagesByChat: state.messagesByChat,
      filter: state.activeFilter,
      searchQuery: state.chatSearchQuery,
      setFilter: state.setActiveFilter,
      setSearchQuery: state.setChatSearchQuery,
      refreshChats: state.refreshChats
    }))
  );

  const filteredChats = useMemo(
    () => filterChats(chats, messagesByChat, searchQuery, filter),
    [chats, messagesByChat, searchQuery, filter]
  );

  const counts = useMemo(
    () => ({
      all: chats.length,
      unread: chats.filter((chat) => chat.unreadCount > 0).length,
      groups: chats.filter((chat) => chat.kind === "group").length
    }),
    [chats]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshChats();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.root}>
      {showHeader ? (
        <View style={styles.header}>
          <SectionHeader
            title="Chats"
            subtitle={`${counts.all} conversations · ${counts.unread} unread`}
            rightSlot={
              <IconButton
                icon="edit-2"
                accessibilityLabel="Start a new conversation"
                onPress={() => router.push("/(app)/new-message")}
              />
            }
          />
        </View>
      ) : null}

      <View style={styles.controls}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery("")}
          placeholder="Search conversations"
        />
        <PresenceRail onOpenConversation={onSelectChat} />
        <View style={styles.filters}>
          {CHAT_FILTERS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              active={filter === item.key}
              count={counts[item.key as keyof typeof counts]}
              onPress={() => setFilter(item.key as ChatFilterKey)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ListEmptyComponent={
          refreshing ? (
            <LoadingSkeleton rows={5} />
          ) : (
            <EmptyState
              title="No conversations"
              description="Adjust the filters or start a new conversation with a colleague."
              icon="message-square"
            />
          )
        }
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            lastMessage={(messagesByChat[item.id] ?? []).slice(-1)[0]}
            active={activeChatId === item.id}
            onPress={() => onSelectChat(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12
  },
  controls: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  list: {
    flex: 1,
    marginTop: 8
  },
  listContent: {
    paddingBottom: 12,
    paddingHorizontal: 6
  },
  separator: {
    height: 2
  }
});
