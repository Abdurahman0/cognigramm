import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { WORKSPACE_NAV_ITEMS, resolveActiveNavKey, type WorkspaceNavItem } from "@/components/layout/navItems";
import { AppText, Badge, GlassView, IconButton, LiquidLens } from "@/components/ui";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMorphingIndicator, type IndicatorSlot } from "@/hooks/useMorphingIndicator";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

interface NavRowProps {
  item: WorkspaceNavItem;
  active: boolean;
  badgeCount: number;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

function NavRow({ item, active, badgeCount, onPress, onLayout }: NavRowProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      {...(Platform.OS === "web" ? { "aria-selected": active } : null)}
      onPress={onPress}
      onLayout={onLayout}
      style={({ pressed, hovered }) => [
        styles.navRow,
        {
          borderRadius: theme.radius.md,
          backgroundColor: active
            ? "transparent"
            : pressed
            ? theme.colors.fillSecondary
            : hovered
            ? theme.colors.fillTertiary
            : "transparent"
        }
      ]}
    >
      <Feather name={item.icon} size={17} color={theme.colors.accent} />
      <AppText
        variant={active ? "subheadEmphasized" : "subhead"}
        numberOfLines={1}
        style={styles.navLabel}
      >
        {item.label}
      </AppText>
      {badgeCount > 0 ? <Badge count={badgeCount} /> : null}
    </Pressable>
  );
}

/** Sidebar in the style of a macOS source list: translucent, tinted selection, grouped. */
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

  const groups = useMemo(() => chats.filter((chat) => chat.kind === "group").slice(0, 12), [chats]);

  const activeIndex = Math.max(
    WORKSPACE_NAV_ITEMS.findIndex((item) => item.key === activeKey),
    0
  );
  const [slots, setSlots] = useState<IndicatorSlot[]>([]);
  const measureSlot = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setSlots((current) => {
      if (current[index]?.start === y && current[index]?.size === height) {
        return current;
      }
      const next = [...current];
      next[index] = { start: y, size: height };
      return next;
    });
  }, []);
  const indicator = useMorphingIndicator(activeIndex, slots, "y");

  const openChat = (chatId: string) => {
    setDesktopChat(chatId);
    router.replace("/(app)/(tabs)/chats");
  };

  return (
    <GlassView
      material="ultraThin"
      radius={theme.radius.panel}
      bordered={false}
      style={[styles.root, { width: theme.layout.sidebarWidth }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open your profile"
        onPress={() => router.replace("/(app)/(tabs)/profile")}
        style={({ hovered, pressed }) => [
          styles.identity,
          {
            borderRadius: theme.radius.lg,
            backgroundColor: pressed
              ? theme.colors.fillSecondary
              : hovered
              ? theme.colors.fillTertiary
              : "transparent"
          }
        ]}
      >
        <Avatar uri={user.avatar} name={user.fullName} size={42} showOnlineDot isOnline={user.isOnline} />
        <View style={styles.identityCopy}>
          <AppText variant="subheadEmphasized" numberOfLines={1}>
            {user.fullName}
          </AppText>
          <AppText variant="caption1" tone="secondary" numberOfLines={1}>
            {ROLE_LABELS[user.role]} · {user.department}
          </AppText>
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
        {indicator.ready ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { height: indicator.size, borderRadius: theme.radius.md },
              indicator.style
            ]}
          >
            <LiquidLens radius={theme.radius.md} style={styles.indicatorFill} />
          </Animated.View>
        ) : null}

        {WORKSPACE_NAV_ITEMS.map((item, index) => (
          <NavRow
            key={item.key}
            item={item}
            active={activeKey === item.key}
            badgeCount={unreadByKey[item.key]}
            onLayout={(event) => measureSlot(index, event)}
            onPress={() => router.replace(item.pathname as never)}
          />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="footnote" tone="secondary">
          GROUP SPACES
        </AppText>
        <IconButton
          icon="plus"
          accessibilityLabel="Create a group conversation"
          size="sm"
          tone="plain"
          onPress={() => router.push("/(app)/new-message")}
        />
      </View>

      <ScrollView
        style={styles.groups}
        contentContainerStyle={styles.groupsContent}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <AppText variant="footnote" tone="tertiary" style={styles.emptyGroups}>
            No group spaces yet. Create one to coordinate a team.
          </AppText>
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
                      : pressed
                      ? theme.colors.fillSecondary
                      : hovered
                      ? theme.colors.fillTertiary
                      : "transparent"
                  }
                ]}
              >
                <Avatar uri={chat.avatar} name={chat.title} size={30} shape="squircle" />
                <View style={styles.groupCopy}>
                  <AppText variant="subhead" numberOfLines={1}>
                    {chat.title}
                  </AppText>
                  <AppText variant="caption1" tone="tertiary" numberOfLines={1}>
                    {chat.memberIds.length} members
                  </AppText>
                </View>
                {chat.unreadCount > 0 ? (
                  <View style={[styles.groupDot, { backgroundColor: theme.colors.accent }]} />
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
    paddingBottom: 12,
    paddingHorizontal: 10,
    paddingTop: 12
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
    gap: 1
  },
  nav: {
    gap: 2
  },
  indicator: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  indicatorFill: {
    height: "100%",
    width: "100%"
  },
  navRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 38,
    paddingHorizontal: 10
  },
  navLabel: {
    flex: 1
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 10,
    paddingTop: 6
  },
  groups: {
    flex: 1
  },
  groupsContent: {
    gap: 2,
    paddingBottom: 8
  },
  emptyGroups: {
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
  groupDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  }
});
