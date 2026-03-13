import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";

import { ChatListItem } from "@/components/chat";
import { EmptyState, LoadingSkeleton, ScreenContainer, SearchBar, SectionHeader } from "@/components/common";
import { CHAT_FILTERS } from "@/constants/chat";
import { ConversationPanel } from "@/features/chat/ConversationPanel";
import { filterChats } from "@/features/chat/selectors";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useChatStore, type ChatFilterKey } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

export default function ChatsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [actionChatId, setActionChatId] = useState<string>("");

  const {
    chats,
    messagesByChat,
    filter,
    searchQuery,
    activeDesktopChatId,
    setFilter,
    setSearchQuery,
    setDesktopChat,
    refreshChats,
    togglePin,
    toggleMute,
    toggleArchive
  } = useChatStore(useShallow((state) => ({
    chats: state.chats,
    messagesByChat: state.messagesByChat,
    filter: state.activeFilter,
    searchQuery: state.chatSearchQuery,
    activeDesktopChatId: state.activeDesktopChatId,
    setFilter: state.setActiveFilter,
    setSearchQuery: state.setChatSearchQuery,
    setDesktopChat: state.setActiveDesktopChatId,
    refreshChats: state.refreshChats,
    togglePin: state.togglePin,
    toggleMute: state.toggleMute,
    toggleArchive: state.toggleArchive
  })));

  const filteredChats = useMemo(
    () => filterChats(chats, messagesByChat, searchQuery, filter),
    [chats, messagesByChat, searchQuery, filter]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshChats();
    setRefreshing(false);
  };

  const selectedActionChat = chats.find((item) => item.id === actionChatId);

  const openChatActions = (chatId: string) => {
    setActionChatId(chatId);
  };

  const closeChatActions = () => {
    setActionChatId("");
  };

  const listElement = (
    <FlatList
      data={filteredChats}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      }
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        refreshing ? (
          <LoadingSkeleton rows={5} />
        ) : (
          <EmptyState
            title="No conversations"
            description="Try adjusting filters or start a new conversation."
            icon="inbox"
          />
        )
      }
      renderItem={({ item }) => (
        <ChatListItem
          chat={item}
          lastMessage={(messagesByChat[item.id] ?? []).slice(-1)[0]}
          active={isDesktop && activeDesktopChatId === item.id}
          onLongPress={() => openChatActions(item.id)}
          onOpenActions={() => openChatActions(item.id)}
          onPress={() => {
            if (isDesktop) {
              setDesktopChat(item.id);
              return;
            }
            router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId: item.id } });
          }}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );

  return (
    <ScreenContainer padded={false} includeBottomInset={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="Business Chats"
          subtitle="Direct, channels, and announcements"
          rightSlot={
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push("/(app)/search")} style={styles.iconBtn}>
                <Feather name="search" size={18} color={theme.colors.textPrimary} />
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/new-message")} style={styles.iconBtn}>
                <Feather name="edit-2" size={18} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
          }
        />
      </View>

      <View style={styles.controls}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} onClear={() => setSearchQuery("")} placeholder="Search chats" />
        <View style={styles.filters}>
          {CHAT_FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key as ChatFilterKey)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                    borderColor: active ? theme.colors.accent : theme.colors.border
                  }
                ]}
              >
                <Text style={{ color: active ? "#FFFFFF" : theme.colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isDesktop ? (
        <View style={styles.desktopRoot}>
          <View style={[styles.leftPane, { borderRightColor: theme.colors.border }]}>{listElement}</View>
          <View style={styles.rightPane}>
            {activeDesktopChatId ? (
              <ConversationPanel chatId={activeDesktopChatId} />
            ) : (
              <View style={styles.emptyPane}>
                <EmptyState title="Select a conversation" description="Choose a chat to open the thread." icon="message-square" />
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.mobileListWrap}>{listElement}</View>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(selectedActionChat)}
        onRequestClose={closeChatActions}
      >
        <Pressable style={styles.actionsBackdrop} onPress={closeChatActions}>
          <Pressable
            onPress={() => undefined}
            style={[
              styles.actionsPanel,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }
            ]}
          >
            <Text style={[styles.actionsTitle, { color: theme.colors.textPrimary }]}>{selectedActionChat?.title}</Text>
            <Text style={[styles.actionsSubtitle, { color: theme.colors.textMuted }]}>Conversation actions</Text>

            <Pressable
              onPress={() => {
                if (selectedActionChat) {
                  togglePin(selectedActionChat.id);
                }
                closeChatActions();
              }}
              style={[styles.actionsButton, { borderColor: theme.colors.border }]}
            >
              <Text style={[styles.actionsButtonText, { color: theme.colors.textPrimary }]}>
                {selectedActionChat?.pinned ? "Unpin" : "Pin"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (selectedActionChat) {
                  toggleArchive(selectedActionChat.id);
                }
                closeChatActions();
              }}
              style={[styles.actionsButton, { borderColor: theme.colors.border }]}
            >
              <Text style={[styles.actionsButtonText, { color: theme.colors.textPrimary }]}>
                {selectedActionChat?.archived ? "Unarchive" : "Archive"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (selectedActionChat) {
                  toggleMute(selectedActionChat.id);
                }
                closeChatActions();
              }}
              style={[styles.actionsButton, { borderColor: theme.colors.border }]}
            >
              <Text style={[styles.actionsButtonText, { color: theme.colors.textPrimary }]}>
                {selectedActionChat?.muted ? "Unmute" : "Mute"}
              </Text>
            </Pressable>

            <Pressable onPress={closeChatActions} style={[styles.closeButton, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  iconBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  controls: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  mobileListWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  listContent: {
    paddingBottom: 8
  },
  desktopRoot: {
    flex: 1,
    flexDirection: "row",
    paddingTop: 12
  },
  leftPane: {
    borderRightWidth: 1,
    flexBasis: 380,
    maxWidth: 420,
    minWidth: 320,
    paddingHorizontal: 16
  },
  rightPane: {
    flex: 1
  },
  emptyPane: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  actionsBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  actionsPanel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    width: "100%"
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "700"
  },
  actionsSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  actionsButton: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  actionsButtonText: {
    fontSize: 14,
    fontWeight: "600"
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "700"
  }
});


