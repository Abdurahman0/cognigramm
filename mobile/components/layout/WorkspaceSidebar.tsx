import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { WORKSPACE_NAV_ITEMS, resolveActiveNavKey, type WorkspaceNavItem } from "@/components/layout/navItems";
import { Badge, GlassView, IconButton } from "@/components/ui";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

interface NavRowProps {
  item: WorkspaceNavItem;
  active: boolean;
  badgeCount: number;
  onPress: () => void;
}

function NavRow({ item, active, badgeCount, onPress }: NavRowProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.navRow,
        {
          borderRadius: theme.radius.lg,
          backgroundColor: active
            ? theme.colors.glassStrong
            : hovered
            ? theme.colors.glassHover
            : "transparent",
          opacity: pressed ? 0.9 : 1
        }
      ]}
    >
      <View
        style={[
          styles.navIcon,
          {
            borderRadius: theme.radius.md,
            backgroundColor: active ? theme.colors.accentMuted : theme.colors.glassSoft
          }
        ]}
      >
        <Feather
          name={item.icon}
          size={16}
          color={active ? theme.colors.accent : theme.colors.textSecondary}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.navLabel,
          { color: active ? theme.colors.textPrimary : theme.colors.textSecondary }
        ]}
      >
        {item.label}
      </Text>
      {badgeCount > 0 ? <Badge count={badgeCount} /> : null}
    </Pressable>
  );
}

/** Persistent workspace sidebar: identity, primary navigation, group shortcuts. */
export function WorkspaceSidebar(): JSX.Element {
  const { theme } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const user = useCurrentUser();
  const activeKey = resolveActiveNavKey(pathname ?? "");

  const { chats, activeDesktopChatId, setDesktopChat } = useChatStore(
    useShallow((state) => ({
      chats: state.chats,
      activeDesktopChatId: state.activeDesktopChatId,
      setDesktopChat: state.setActiveDesktopChatId
    }))
  );

  const unreadByKey = useMemo(() => {
    const unreadTotal = chats.reduce((total, chat) => total + chat.unreadCount, 0);
    return { chats: unreadTotal, contacts: 0, calls: 0, profile: 0 } as Record<WorkspaceNavItem["key"], number>;
  }, [chats]);

  const groups = useMemo(
    () =>
      chats
        .filter((chat) => chat.kind === "group")
        .slice(0, 12),
    [chats]
  );

  const openChat = (chatId: string) => {
    setDesktopChat(chatId);
    router.replace("/(app)/(tabs)/chats");
  };

  return (
    <GlassView
      tone="soft"
      radius={theme.radius.xxl}
      bordered={false}
      style={[styles.root, { width: theme.layout.sidebarWidth }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open your profile"
        onPress={() => router.replace("/(app)/(tabs)/profile")}
        style={({ hovered }) => [
          styles.identity,
          {
            borderRadius: theme.radius.lg,
            backgroundColor: hovered ? theme.colors.glassHover : "transparent"
          }
        ]}
      >
        <Avatar uri={user.avatar} name={user.fullName} size={40} showOnlineDot isOnline={user.isOnline} />
        <View style={styles.identityCopy}>
          <Text numberOfLines={1} style={[styles.identityName, { color: theme.colors.textPrimary }]}>
            {user.fullName}
          </Text>
          <Text numberOfLines={1} style={[styles.identityMeta, { color: theme.colors.textMuted }]}>
            {ROLE_LABELS[user.role]} · {user.department}
          </Text>
        </View>
        <IconButton
          icon="settings"
          accessibilityLabel="Open settings"
          size="sm"
          tone="plain"
          onPress={() => router.push("/(app)/settings" as never)}
        />
      </Pressable>

      <View style={styles.nav}>
        {WORKSPACE_NAV_ITEMS.map((item) => (
          <NavRow
            key={item.key}
            item={item}
            active={activeKey === item.key}
            badgeCount={unreadByKey[item.key]}
            onPress={() => router.replace(item.pathname as never)}
          />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>Group spaces</Text>
        <IconButton
          icon="plus"
          accessibilityLabel="Create a group conversation"
          size="sm"
          tone="plain"
          onPress={() => router.push("/(app)/new-message")}
        />
      </View>

      <ScrollView style={styles.groups} contentContainerStyle={styles.groupsContent} showsVerticalScrollIndicator={false}>
        {groups.length === 0 ? (
          <Text style={[styles.emptyGroups, { color: theme.colors.textMuted }]}>
            No group spaces yet. Create one to coordinate a team.
          </Text>
        ) : (
          groups.map((chat) => {
            const active = activeDesktopChatId === chat.id && activeKey === "chats";
            return (
              <Pressable
                key={chat.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${chat.title}`}
                onPress={() => openChat(chat.id)}
                style={({ pressed, hovered }) => [
                  styles.groupRow,
                  {
                    borderRadius: theme.radius.md,
                    backgroundColor: active
                      ? theme.colors.accentMuted
                      : hovered
                      ? theme.colors.glassHover
                      : "transparent",
                    opacity: pressed ? 0.9 : 1
                  }
                ]}
              >
                <Avatar uri={chat.avatar} name={chat.title} size={30} shape="squircle" />
                <View style={styles.groupCopy}>
                  <Text numberOfLines={1} style={[styles.groupTitle, { color: theme.colors.textPrimary }]}>
                    {chat.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.groupMeta, { color: theme.colors.textMuted }]}>
                    {chat.memberIds.length} members
                  </Text>
                </View>
                {chat.unreadCount > 0 ? (
                  <View
                    style={[styles.groupDot, { backgroundColor: theme.colors.accent }]}
                  />
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 10
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 8
  },
  identityCopy: {
    flex: 1,
    gap: 2
  },
  identityName: {
    fontSize: 14,
    fontWeight: "700"
  },
  identityMeta: {
    fontSize: 11
  },
  nav: {
    gap: 2
  },
  navRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 8
  },
  navIcon: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 10,
    paddingTop: 4
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  groups: {
    flex: 1
  },
  groupsContent: {
    gap: 2,
    paddingBottom: 8
  },
  emptyGroups: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingTop: 6
  },
  groupRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 8
  },
  groupCopy: {
    flex: 1,
    gap: 1
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "600"
  },
  groupMeta: {
    fontSize: 11
  },
  groupDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  }
});
