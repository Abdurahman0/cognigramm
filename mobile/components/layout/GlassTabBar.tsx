import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WORKSPACE_NAV_ITEMS } from "@/components/layout/navItems";
import { Badge, GlassView } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";

/** Floating translucent tab bar for phone and tablet viewports. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps): JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const chats = useChatStore((store) => store.chats);
  const unreadTotal = chats.reduce((total, chat) => total + chat.unreadCount, 0);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <GlassView
        tone="strong"
        radius={theme.radius.pill}
        highlight
        elevation="floating"
        style={styles.bar}
      >
        {state.routes.map((route, index) => {
          const navItem = WORKSPACE_NAV_ITEMS.find((item) => item.key === route.name);
          const focused = state.index === index;
          const badgeCount = route.name === "chats" ? unreadTotal : 0;
          const color = focused ? theme.colors.accent : theme.colors.textMuted;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={navItem?.label ?? route.name}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={({ pressed }) => [
                styles.item,
                {
                  borderRadius: theme.radius.pill,
                  backgroundColor: focused ? theme.colors.accentMuted : "transparent",
                  opacity: pressed ? 0.85 : 1
                }
              ]}
            >
              <View>
                <Feather name={navItem?.icon ?? "circle"} size={19} color={color} />
                {badgeCount > 0 ? (
                  <View style={styles.badge}>
                    <Badge count={badgeCount} />
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {navItem?.label ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingTop: 6
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 6
  },
  label: {
    fontSize: 10,
    fontWeight: "700"
  },
  badge: {
    position: "absolute",
    right: -10,
    top: -6
  }
});
