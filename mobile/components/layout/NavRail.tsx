import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WORKSPACE_NAV_ITEMS, resolveActiveNavKey, type WorkspaceNavItem } from "@/components/layout/navItems";
import { Badge, GlassView, IconButton } from "@/components/ui";
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

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.item,
        {
          borderRadius: theme.radius.lg,
          backgroundColor: active
            ? theme.colors.accentMuted
            : hovered
            ? theme.colors.glassHover
            : "transparent",
          opacity: pressed ? 0.85 : 1
        }
      ]}
    >
      <Feather
        name={item.icon}
        size={20}
        color={active ? theme.colors.accent : theme.colors.textSecondary}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.itemLabel,
          { color: active ? theme.colors.accent : theme.colors.textMuted }
        ]}
      >
        {item.label}
      </Text>
      {badgeCount > 0 ? (
        <View style={styles.itemBadge}>
          <Badge count={badgeCount} />
        </View>
      ) : null}
    </Pressable>
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
      tone="strong"
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
          onPress={() => router.push("/(app)/settings")}
        />
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    paddingTop: 14
  },
  brand: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40
  },
  logo: {
    height: 30,
    width: 30
  },
  items: {
    alignItems: "center",
    flex: 1,
    gap: 6,
    paddingTop: 6,
    width: "100%"
  },
  item: {
    alignItems: "center",
    gap: 3,
    justifyContent: "center",
    minHeight: 56,
    width: "84%"
  },
  itemLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.1
  },
  itemBadge: {
    position: "absolute",
    right: 6,
    top: 6
  },
  footer: {
    alignItems: "center",
    gap: 8
  }
});
