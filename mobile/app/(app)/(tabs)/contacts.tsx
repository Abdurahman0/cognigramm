import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, Avatar, EmptyState, SearchBar, SectionHeader, UserCard } from "@/components/common";
import { WorkspacePane } from "@/components/layout";
import { Chip, GlassView, IconButton } from "@/components/ui";
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

  const listPane = (
    <View style={styles.pane}>
      <View style={styles.header}>
        <SectionHeader
          title="Directory"
          subtitle={`${filteredUsers.length} colleagues`}
          rightSlot={
            <IconButton
              icon="user-plus"
              accessibilityLabel="Start a new conversation"
              onPress={() => router.push("/(app)/new-message")}
            />
          }
        />
      </View>
      <View style={styles.controls}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search people, roles, teams"
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
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No colleagues found" description="Try a different name, role, or team." icon="users" />
        }
        renderItem={({ item }) => (
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
            <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.profileHero}>
              <Avatar
                uri={selectedUser.avatar}
                name={selectedUser.fullName}
                size={96}
                shape="squircle"
                showOnlineDot
                isOnline={selectedUser.isOnline}
              />
              <View style={styles.profileCopy}>
                <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>
                  {selectedUser.fullName}
                </Text>
                <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]}>
                  {ROLE_LABELS[selectedUser.role]} · {selectedUser.title}
                </Text>
                <Text style={[styles.profileMeta, { color: theme.colors.textMuted }]}>
                  {selectedUser.department} · {PRESENCE_LABELS[selectedUser.presence]}
                </Text>
                <View style={styles.profileActions}>
                  <AppButton
                    label="Message"
                    fullWidth={false}
                    icon={<Feather name="message-square" size={15} color={theme.colors.onAccent} />}
                    onPress={() => {
                      openConversation(selectedUser).catch(() => undefined);
                    }}
                  />
                </View>
              </View>
            </GlassView>

            <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.profileCard}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>About</Text>
              <Text style={[styles.cardBody, { color: theme.colors.textSecondary }]}>
                {selectedUser.about || "No profile summary yet."}
              </Text>
            </GlassView>

            <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.profileCard}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Contact</Text>
              {[
                { icon: "mail" as const, label: "Email", value: selectedUser.email },
                { icon: "phone" as const, label: "Phone", value: selectedUser.phone ?? "Not available" },
                { icon: "map-pin" as const, label: "Location", value: selectedUser.officeLocation ?? "Not available" },
                { icon: "clock" as const, label: "Timezone", value: selectedUser.timezone }
              ].map((row) => (
                <View key={row.label} style={styles.contactRow}>
                  <View style={[styles.contactIcon, { backgroundColor: theme.colors.glassSoft }]}>
                    <Feather name={row.icon} size={14} color={theme.colors.textSecondary} />
                  </View>
                  <Text style={[styles.contactLabel, { color: theme.colors.textMuted }]}>{row.label}</Text>
                  <Text numberOfLines={1} style={[styles.contactValue, { color: theme.colors.textPrimary }]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </GlassView>
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
    paddingHorizontal: 8
  },
  separator: {
    height: 8
  },
  profileContent: {
    gap: 12,
    padding: 16
  },
  profileHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    padding: 18
  },
  profileCopy: {
    flex: 1,
    gap: 4
  },
  profileName: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  profileRole: {
    fontSize: 14,
    fontWeight: "600"
  },
  profileMeta: {
    fontSize: 13
  },
  profileActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  profileCard: {
    gap: 10,
    padding: 18
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700"
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20
  },
  contactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 40
  },
  contactIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  contactLabel: {
    fontSize: 12,
    width: 84
  },
  contactValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right"
  },
  emptyPane: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28
  }
});
