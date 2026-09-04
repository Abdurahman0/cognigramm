import type { ReactNode } from "react";
import { Animated, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { AppText, GlassView } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";

interface FloatingTitleBarProps {
  title: string;
  /** Scroll position of the list underneath, driving the glass fade-in. */
  scrollY: Animated.Value;
  actions?: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * iOS 26 navigation bar: invisible over the top of the content, then the glass and the
 * compact title fade in as the large title scrolls beneath it.
 */
export function FloatingTitleBar({
  title,
  scrollY,
  actions,
  onLayout
}: FloatingTitleBarProps): JSX.Element {
  const { theme } = useAppTheme();

  const glassOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [24, 64],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const glassScale = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0.97, 1],
    extrapolate: "clamp"
  });
  const titleShift = scrollY.interpolate({
    inputRange: [24, 64],
    outputRange: [6, 0],
    extrapolate: "clamp"
  });

  return (
    <View pointerEvents="box-none" style={styles.root} onLayout={onLayout}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: glassOpacity, transform: [{ scale: glassScale }] }]}
      >
        <GlassView
          material="regular"
          radius={theme.radius.panel}
          highlight
          elevation="panel"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleShift }] }]}
      >
        <AppText variant="headline" numberOfLines={1}>
          {title}
        </AppText>
      </Animated.View>

      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    left: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 5,
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 20
  },
  title: {
    flex: 1
  }
});
