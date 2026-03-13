import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { EmptyState, ScreenContainer, SearchBar, SectionHeader, UserCard } from "@/components/common";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

export default function ContactsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const currentUser = useCurrentUser();
  const { users, query, setQuery, startDirectConversation } = useChatStore(useShallow((state) => ({
    users: state.users,
    query: state.chatSearchQuery,
    setQuery: state.setChatSearchQuery,
    startDirectConversation: state.startDirectConversation
  })));

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => {
        if (!normalized) return true;
        return (
          user.fullName.toLowerCase().includes(normalized) ||
          user.department.toLowerCase().includes(normalized) ||
          user.role.toLowerCase().includes(normalized)
        );
      });
  }, [users, currentUser.id, query]);

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader title="Employee Directory" subtitle="Find colleagues by name, role, or department" />
      </View>
      <View style={styles.content}>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Search people" />
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState title="No employees found" description="Try a different search term." icon="users" />
          }
          renderItem={({ item }) => (
            <UserCard
              user={item}
              trailingLabel={item.isOnline ? "Online" : "Offline"}
              onPress={async () => {
                try {
                  const id = await startDirectConversation(item.id);
                  router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId: id } });
                } catch (error) {
                  toast.error("Unable to open chat", error instanceof Error ? error.message : "Unexpected error");
                }
              }}
            />
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
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  listContent: {
    paddingBottom: 20
  }
});
