import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { WORKSPACE_NAV_ITEMS, resolveActiveNavKey, type WorkspaceNavItem } from "@/components/layout/navItems";
import { AppText, Badge, GlassView, IconButton, PressableScale } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";

interface RailItemProps {
  item: WorkspaceNavItem;
  active: boolean;
  badgeCount?: number;
  onPress: () => void;
}

function RailItem({ item, active, badgeCount = 0, onPress }: RailItemProps): JSX.Element {
  const { theme } = useAppTheme();
  const color = active ? theme.colors.accent : theme.colors.textSecondary;

  return (
    <PressableScale
      scaleTo={0.93}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.itemPressable}
    >
      <View
        style={[
          styles.item,
          {
            borderRadius: theme.radius.lg,
            backgroundColor: active ? theme.colors.accentMuted : "transparent"
          }
        ]}
      >
        <View>
          <Feather name={item.icon} size={22} color={color} />
          {badgeCount > 0 ? (
            <View style={styles.itemBadge}>
              <Badge count={badgeCount} tone="danger" />
            </View>
          ) : null}
        </View>
        <AppText variant="caption2" color={color} numberOfLines={1}>
          {item.label}
        </AppText>
      </View>
    </PressableScale>
  );
}

/** Floating vertical navigation used on desktop-width viewports. */
export function NavRail(): JSX.Element {
  const { theme } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const chats = useChatStore((state) => state.chats);
  const activeKey = resolveActiveNavKey(pathname ?? "");
  const unreadTotal = chats.reduce((total, chat) => total + chat.unreadCount, 0);

  return (
    <GlassView
      material="thick"
      radius={theme.radius.panel}
      highlight
      elevation="panel"
      style={[styles.root, { width: theme.layout.railWidth }]}
    >
      <View style={styles.brand}>
        <Image source={require("@/assets/logo.png")} style={styles.logo} contentFit="contain" />
      </View>

      <View style={styles.items}>
        {WORKSPACE_NAV_ITEMS.map((item) => (
          <RailItem
            key={item.key}
            item={item}
            active={activeKey === item.key}
            badgeCount={item.key === "chats" ? unreadTotal : 0}
            onPress={() => router.replace(item.pathname as never)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <IconButton
          icon="edit-2"
          accessibilityLabel="Start a new conversation"
          tone="accent"
          size="md"
          onPress={() => router.push("/(app)/new-message")}
        />
        <IconButton
          icon="settings"
          accessibilityLabel="Open settings"
          size="md"
          onPress={() => router.push("/(app)/settings" as never)}
        />
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 14,
    paddingTop: 16
  },
  brand: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38
  },
  logo: {
    height: 28,
    width: 28
  },
  items: {
    alignItems: "center",
    flex: 1,
    gap: 6,
    paddingTop: 8,
    width: "100%"
  },
  itemPressable: {
    width: "86%"
  },
  item: {
    alignItems: "center",
    gap: 3,
    justifyContent: "center",
    minHeight: 58,
    paddingVertical: 6,
    width: "100%"
  },
  itemBadge: {
    position: "absolute",
    right: -14,
    top: -6
  },
  footer: {
    alignItems: "center",
    gap: 10
  }
});
