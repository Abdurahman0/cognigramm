import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WORKSPACE_NAV_ITEMS } from "@/components/layout/navItems";
import { AppText, Badge, GlassView, PressableScale } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";

/** Floating capsule tab bar: thick glass, tinted pill under the selected tab. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps): JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const chats = useChatStore((store) => store.chats);
  const unreadTotal = chats.reduce((total, chat) => total + chat.unreadCount, 0);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <GlassView
        material="thick"
        radius={theme.radius.pill}
        highlight
        elevation="floating"
        style={styles.bar}
      >
        {state.routes.map((route, index) => {
          const navItem = WORKSPACE_NAV_ITEMS.find((item) => item.key === route.name);
          const focused = state.index === index;
          const badgeCount = route.name === "chats" ? unreadTotal : 0;
          const color = focused ? theme.colors.accent : theme.colors.textSecondary;

          return (
            <PressableScale
              key={route.key}
              scaleTo={0.92}
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
              style={styles.itemPressable}
            >
              <View
                style={[
                  styles.item,
                  {
                    borderRadius: theme.radius.pill,
                    backgroundColor: focused ? theme.colors.accentMuted : "transparent"
                  }
                ]}
              >
                <View>
                  <Feather name={navItem?.icon ?? "circle"} size={22} color={color} />
                  {badgeCount > 0 ? (
                    <View style={styles.badge}>
                      <Badge count={badgeCount} tone="danger" />
                    </View>
                  ) : null}
                </View>
                <AppText variant="caption2" color={color} numberOfLines={1}>
                  {navItem?.label ?? route.name}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 8
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  itemPressable: {
    flex: 1
  },
  item: {
    alignItems: "center",
    gap: 3,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  badge: {
    position: "absolute",
    right: -12,
    top: -6
  }
});
