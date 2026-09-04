import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Animated, Platform, RefreshControl, StyleSheet, View } from "react-native";

import { ChatListItem } from "@/components/chat";
import { EmptyState, LoadingSkeleton, SearchBar } from "@/components/common";
import { FloatingTitleBar } from "@/components/layout";
import { AppText, Chip, IconButton } from "@/components/ui";
import { CHAT_FILTERS } from "@/constants/chat";
import { PresenceRail } from "@/features/chat/PresenceRail";
import { filterChats } from "@/features/chat/selectors";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useChatStore, type ChatFilterKey } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

interface ChatListPaneProps {
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  /** Hidden when the surrounding screen already renders its own title row. */
  showHeader?: boolean;
}

/**
 * Search, presence, and the conversation list. The title bar floats as glass and the
 * list scrolls underneath it, the way an iOS navigation bar behaves.
 */
export function ChatListPane({
  activeChatId,
  onSelectChat,
  showHeader = true
}: ChatListPaneProps): JSX.Element {
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [barHeight, setBarHeight] = useState(52);
  const scrollY = useRef(new Animated.Value(0)).current;

  const {
    chats,
    messagesByChat,
    filter,
    searchQuery,
    setFilter,
    setSearchQuery,
    refreshChats,
    markConversationRead
  } = useChatStore(
    useShallow((state) => ({
      chats: state.chats,
      messagesByChat: state.messagesByChat,
      filter: state.activeFilter,
      searchQuery: state.chatSearchQuery,
      setFilter: state.setActiveFilter,
      setSearchQuery: state.setChatSearchQuery,
      refreshChats: state.refreshChats,
      markConversationRead: state.markConversationRead
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

  const listHeader = (
    <View style={styles.listHeader}>
      <AppText variant="largeTitle">Chats</AppText>
      <AppText variant="subhead" tone="secondary" style={styles.subtitle}>
        {counts.all} conversations · {counts.unread} unread
      </AppText>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onClear={() => setSearchQuery("")}
        placeholder="Search conversations"
        style={styles.search}
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
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        data={filteredChats}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== "web"
        })}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: showHeader ? barHeight + 18 : 12,
            paddingBottom: isDesktop ? 16 : theme.layout.tabBarClearance
          }
        ]}
        ListHeaderComponent={showHeader ? listHeader : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
            progressViewOffset={barHeight}
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
            onMarkRead={() => {
              markConversationRead(item.id).catch(() => undefined);
            }}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      {showHeader ? (
        <FloatingTitleBar
          title="Chats"
          scrollY={scrollY}
          onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
          actions={
            <IconButton
              icon="edit-2"
              accessibilityLabel="Start a new conversation"
              size="md"
              onPress={() => router.push("/(app)/new-message")}
            />
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 8
  },
  listHeader: {
    gap: 10,
    paddingBottom: 6,
    paddingHorizontal: 8,
    paddingTop: 6
  },
  subtitle: {
    marginTop: -6
  },
  search: {
    marginTop: 4
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  floatingSpacer: {
    height: 0
  }
});
