import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WORKSPACE_NAV_ITEMS } from "@/components/layout/navItems";
import { AppText, Badge, GlassView, LiquidLens, PressableScale } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useMorphingIndicator, type IndicatorSlot } from "@/hooks/useMorphingIndicator";
import { useChatStore } from "@/store/chatStore";
import { motion } from "@/theme";

/**
 * Floating capsule tab bar.
 *
 * A single glass lens marks the active tab. Tapping springs it across; pressing and
 * dragging hands it to the finger, so it slides under your thumb, stretches with the
 * speed of the scrub, magnifies whichever tab it is passing over, and commits to the
 * one you lift on.
 */
export function GlassTabBar({ state, navigation }: BottomTabBarProps): JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const chats = useChatStore((store) => store.chats);
  const unreadTotal = chats.reduce((total, chat) => total + chat.unreadCount, 0);
  const [slots, setSlots] = useState<IndicatorSlot[]>([]);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const measureSlot = useCallback((index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setSlots((current) => {
      if (current[index]?.start === x && current[index]?.size === width) {
        return current;
      }
      const next = [...current];
      next[index] = { start: x, size: width };
      return next;
    });
  }, []);

  const indicator = useMorphingIndicator(state.index, slots, "x");
  const indicatorRef = useRef(indicator);
  indicatorRef.current = indicator;
  const routesRef = useRef(state.routes);
  routesRef.current = state.routes;
  const activeIndexRef = useRef(state.index);
  activeIndexRef.current = state.index;

  const commit = useCallback(
    (index: number) => {
      const route = routesRef.current[index];
      if (!route) {
        return;
      }
      indicatorRef.current.release(index);
      if (index === activeIndexRef.current) {
        return;
      }
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    },
    [navigation]
  );

  // Scrubbing only takes over once the finger actually moves, so plain taps still
  // reach the buttons underneath.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 6,
        onPanResponderMove: (event) => {
          const x = event.nativeEvent.locationX;
          indicatorRef.current.dragTo(x);
          setScrubIndex(indicatorRef.current.slotAt(x));
        },
        onPanResponderRelease: (event) => {
          const index = indicatorRef.current.slotAt(event.nativeEvent.locationX);
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
        <View style={styles.row} {...panResponder.panHandlers}>
        {indicator.ready ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { width: indicator.size, borderRadius: theme.radius.pill },
              indicator.style
            ]}
          >
            <LiquidLens radius={theme.radius.pill} style={styles.indicatorFill} />
          </Animated.View>
        ) : null}

        {state.routes.map((route, index) => {
          const navItem = WORKSPACE_NAV_ITEMS.find((item) => item.key === route.name);
          const focused = state.index === index;
          const scrubbedOver = scrubIndex === index;
          const badgeCount = route.name === "chats" ? unreadTotal : 0;
          const color = focused || scrubbedOver ? theme.colors.accent : theme.colors.textSecondary;

          return (
            <PressableScale
              key={route.key}
              scaleTo={0.92}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={navItem?.label ?? route.name}
              onLayout={(event) => measureSlot(index, event)}
              onPress={() => commit(index)}
              style={styles.itemPressable}
            >
              <TabItemContent
                icon={navItem?.icon ?? "circle"}
                label={navItem?.label ?? route.name}
                color={color}
                badgeCount={badgeCount}
                magnified={scrubbedOver}
              />
            </PressableScale>
          );
        })}
        </View>
      </GlassView>
    </View>
  );
}

interface TabItemContentProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  color: string;
  badgeCount: number;
  /** The lens is currently over this tab, so it lifts toward the glass. */
  magnified: boolean;
}

function TabItemContent({ icon, label, color, badgeCount, magnified }: TabItemContentProps): JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: magnified ? 1.12 : 1,
      damping: motion.press.damping,
      stiffness: motion.press.stiffness,
      mass: motion.press.mass,
      useNativeDriver: true
    }).start();
  }, [magnified, scale]);

  return (
    <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
      <View>
        <Feather name={icon} size={22} color={color} />
        {badgeCount > 0 ? (
          <View style={styles.badge}>
            <Badge count={badgeCount} tone="danger" />
          </View>
        ) : null}
      </View>
      <AppText variant="caption2" color={color} numberOfLines={1}>
        {label}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: "transparent",
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 8,
    position: "absolute",
    right: 0
  },
  bar: {
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    justifyContent: "space-between"
  },
  indicator: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0
  },
  /* Inset inside the slot so the bar keeps a margin around the active lens, while the
     indicator box itself stays slot-sized for the centring maths. */
  indicatorFill: {
    flex: 1,
    margin: 3
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
