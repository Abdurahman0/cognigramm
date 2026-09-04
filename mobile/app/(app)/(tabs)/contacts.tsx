import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Animated, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, Avatar, EmptyState, SearchBar, UserCard } from "@/components/common";
import { FloatingTitleBar, WorkspacePane } from "@/components/layout";
import { AppText, Chip, GlassView, IconButton, ListRow, ListSection } from "@/components/ui";
import { PRESENCE_LABELS } from "@/constants/chat";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppToast } from "@/hooks/useAppToast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useResponsive } from "@/hooks/useResponsive";
import { useChatStore } from "@/store/chatStore";
import type { User } from "@/types";
import { useShallow } from "zustand/react/shallow";

type DirectoryFilter = "all" | "online" | "leads";

const LEAD_ROLES = new Set(["ceo", "cto", "manager", "hr"]);

const DIRECTORY_FILTERS: { key: DirectoryFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "online", label: "Available" },
  { key: "leads", label: "Leadership" }
];

export default function ContactsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const { isDesktop } = useResponsive();
  const currentUser = useCurrentUser();
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [barHeight, setBarHeight] = useState(52);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { users, query, setQuery, startDirectConversation } = useChatStore(
    useShallow((state) => ({
      users: state.users,
      query: state.chatSearchQuery,
      setQuery: state.setChatSearchQuery,
      startDirectConversation: state.startDirectConversation
    }))
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => {
        if (filter === "online") {
          return user.isOnline;
        }
        if (filter === "leads") {
          return LEAD_ROLES.has(user.role);
        }
        return true;
      })
      .filter((user) => {
        if (!normalized) {
          return true;
        }
        return (
          user.fullName.toLowerCase().includes(normalized) ||
          user.department.toLowerCase().includes(normalized) ||
          user.role.toLowerCase().includes(normalized) ||
          user.title.toLowerCase().includes(normalized)
        );
      });
  }, [currentUser.id, filter, query, users]);

  const selectedUser = useMemo(
    () => filteredUsers.find((user) => user.id === selectedUserId) ?? null,
    [filteredUsers, selectedUserId]
  );

  const openConversation = async (user: User) => {
    try {
      const chatId = await startDirectConversation(user.id);
      router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId } });
    } catch (error) {
      toast.error("Unable to open chat", error instanceof Error ? error.message : "Unexpected error");
    }
  };

  const bottomClearance = isDesktop ? 16 : theme.layout.tabBarClearance;

  const listHeader = (
    <View style={styles.listHeader}>
      <AppText variant="largeTitle">Directory</AppText>
      <AppText variant="subhead" tone="secondary" style={styles.subtitle}>
        {filteredUsers.length} colleagues
      </AppText>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery("")}
        placeholder="Search people, roles, teams"
        style={styles.search}
      />
      <View style={styles.filters}>
        {DIRECTORY_FILTERS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            active={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </View>
    </View>
  );

  const listPane = (
    <View style={styles.pane}>
      <Animated.FlatList
        data={filteredUsers}
        keyExtractor={(item: (typeof filteredUsers)[number]) => item.id}
        style={styles.list}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== "web"
        })}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: barHeight + 18, paddingBottom: bottomClearance }
        ]}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.colors.separator }]} />
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No colleagues found" description="Try a different name, role, or team." icon="users" />
        }
        renderItem={({ item }: { item: User }) => (
          <UserCard
            user={item}
            trailingLabel={PRESENCE_LABELS[item.presence]}
            onPress={() => {
              if (isDesktop) {
                setSelectedUserId(item.id);
                return;
              }
              openConversation(item).catch(() => undefined);
            }}
          />
        )}
      />

      <FloatingTitleBar
        title="Directory"
        scrollY={scrollY}
        onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
        actions={
          <IconButton
            icon="user-plus"
            accessibilityLabel="Start a new conversation"
            onPress={() => router.push("/(app)/new-message")}
          />
        }
      />
    </View>
  );

  if (!isDesktop) {
    return (
      <SafeAreaView edges={["top"]} style={styles.mobileRoot}>
        {listPane}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.desktopRoot}>
      <WorkspacePane width={theme.layout.listPaneWidth}>{listPane}</WorkspacePane>
      <WorkspacePane>
        {selectedUser ? (
          <ScrollView contentContainerStyle={styles.profileContent} showsVerticalScrollIndicator={false}>
            <GlassView
              material="ultraThin"
              radius={theme.radius.panel}
              bordered={false}
              highlight
              style={styles.profileHero}
            >
              <Avatar
                uri={selectedUser.avatar}
                name={selectedUser.fullName}
                size={104}
                shape="squircle"
                showOnlineDot
                isOnline={selectedUser.isOnline}
              />
              <AppText variant="title1" style={styles.profileName}>
                {selectedUser.fullName}
              </AppText>
              <AppText variant="subhead" tone="secondary">
                {ROLE_LABELS[selectedUser.role]} · {selectedUser.title}
              </AppText>
              <AppText variant="footnote" tone="tertiary">
                {selectedUser.department} · {PRESENCE_LABELS[selectedUser.presence]}
              </AppText>
              <View style={styles.profileActions}>
                <AppButton
                  label="Message"
                  fullWidth={false}
                  icon={<Feather name="message-circle" size={16} color={theme.colors.onAccent} />}
                  onPress={() => {
                    openConversation(selectedUser).catch(() => undefined);
                  }}
                />
              </View>
            </GlassView>

            {selectedUser.about ? (
              <ListSection header="About">
                <View style={styles.aboutRow}>
                  <AppText variant="body" tone="secondary">
                    {selectedUser.about}
                  </AppText>
                </View>
              </ListSection>
            ) : null}

            <ListSection header="Contact">
              <ListRow
                icon="mail"
                iconColor={theme.colors.accent}
                title="Email"
                value={selectedUser.email}
                showChevron={false}
              />
              <ListRow
                icon="phone"
                iconColor={theme.colors.success}
                title="Phone"
                value={selectedUser.phone ?? "Not available"}
                showChevron={false}
              />
              <ListRow
                icon="map-pin"
                iconColor={theme.colors.danger}
                title="Location"
                value={selectedUser.officeLocation ?? "Not available"}
                showChevron={false}
              />
              <ListRow
                icon="clock"
                iconColor={theme.colors.textSecondary}
                title="Time zone"
                value={selectedUser.timezone}
                showChevron={false}
              />
            </ListSection>
          </ScrollView>
        ) : (
          <View style={styles.emptyPane}>
            <EmptyState
              title="Select a colleague"
              description="Pick someone from the directory to see their profile and start a conversation."
              icon="user"
            />
          </View>
        )}
      </WorkspacePane>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  pane: {
    flex: 1,
    minWidth: 0
  },
  listHeader: {
    gap: 10,
    paddingBottom: 8,
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
  list: {
    flex: 1
  },
  listContent: {},
  separator: {
    height: StyleSheet.hairlineWidth * 2,
    marginLeft: 72
  },
  profileContent: {
    gap: 18,
    padding: 18
  },
  profileHero: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 28
  },
  profileName: {
    marginTop: 14
  },
  profileActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  aboutRow: {
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  emptyPane: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28
  }
});
