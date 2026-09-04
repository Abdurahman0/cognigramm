import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { WORKSPACE_NAV_ITEMS, resolveActiveNavKey, type WorkspaceNavItem } from "@/components/layout/navItems";
import { AppText, Badge, GlassView, IconButton, LiquidLens, PressableScale } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useMorphingIndicator, type IndicatorSlot } from "@/hooks/useMorphingIndicator";
import { useChatStore } from "@/store/chatStore";

interface RailItemProps {
  item: WorkspaceNavItem;
  active: boolean;
  /** The bead is resting on this item, which is what the accent tint follows. */
  lit: boolean;
  badgeCount?: number;
  /** The lens is currently over this item while scrubbing. */
  magnified?: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

function RailItem({
  item,
  active,
  lit,
  badgeCount = 0,
  magnified = false,
  onPress,
  onLayout
}: RailItemProps): JSX.Element {
  const { theme } = useAppTheme();
  const color = lit ? theme.colors.accent : theme.colors.textSecondary;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: magnified ? 1.12 : 1,
      damping: 26,
      stiffness: 420,
      mass: 0.7,
      useNativeDriver: true
    }).start();
  }, [magnified, scale]);

  return (
    <PressableScale
      scaleTo={0.93}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      {...(Platform.OS === "web" ? { "aria-selected": active } : null)}
      onPress={onPress}
      onLayout={onLayout}
      style={styles.itemPressable}
    >
      <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
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
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Floating vertical navigation for desktop. Shares the tab bar's morphing indicator:
 * one glass pill slides between destinations and stretches vertically as it travels.
 */
export function NavRail(): JSX.Element {
  const { theme } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const chats = useChatStore((state) => state.chats);
  const activeKey = resolveActiveNavKey(pathname ?? "");
  const activeIndex = Math.max(
    WORKSPACE_NAV_ITEMS.findIndex((item) => item.key === activeKey),
    0
  );
  const unreadTotal = chats.reduce((total, chat) => total + chat.unreadCount, 0);
  const [slots, setSlots] = useState<IndicatorSlot[]>([]);
  const [itemWidth, setItemWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const measureSlot = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height, width } = event.nativeEvent.layout;
    setItemWidth((current) => (current === width ? current : width));
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
  const indicatorRef = useRef(indicator);
  indicatorRef.current = indicator;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const commit = useCallback(
    (index: number) => {
      const item = WORKSPACE_NAV_ITEMS[index];
      indicatorRef.current.release(index);
      if (item) {
        router.replace(item.pathname as never);
      }
    },
    [router]
  );

  // Holding and dragging along the rail scrubs the lens; a plain tap still selects.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderMove: (event) => {
          const y = event.nativeEvent.locationY;
          indicatorRef.current.dragTo(y);
          setScrubIndex(indicatorRef.current.slotAt(y));
        },
        onPanResponderRelease: (event) => {
          const index = indicatorRef.current.slotAt(event.nativeEvent.locationY);
          setScrubIndex(null);
          commit(index);
        },
        onPanResponderTerminate: () => {
          setScrubIndex(null);
          indicatorRef.current.release(activeIndexRef.current);
        }
      }),
    [commit]
  );

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

      <View style={styles.items} {...panResponder.panHandlers}>
        {indicator.ready && itemWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { height: indicator.size, width: itemWidth, borderRadius: theme.radius.lg },
              indicator.style
            ]}
          >
            <LiquidLens radius={theme.radius.lg} style={styles.indicatorFill} />
          </Animated.View>
        ) : null}

        {WORKSPACE_NAV_ITEMS.map((item, index) => (
          <RailItem
            key={item.key}
            item={item}
            active={activeKey === item.key}
            lit={(scrubIndex ?? activeIndex) === index}
            badgeCount={item.key === "chats" ? unreadTotal : 0}
            magnified={scrubIndex === index}
            onLayout={(event) => measureSlot(index, event)}
            onPress={() => commit(index)}
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
  indicator: {
    alignSelf: "center",
    left: "7%",
    position: "absolute",
    top: 0
  },
  indicatorFill: {
    height: "100%",
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
