import type { PropsWithChildren } from "react";
import { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { motion } from "@/theme";

interface PressableScaleProps extends PropsWithChildren<Omit<PressableProps, "style" | "children">> {
  /** How far the control compresses while held. */
  scaleTo?: number;
  /** How far it rises toward the pointer on hover. */
  hoverLift?: number;
  style?: StyleProp<ViewStyle>;
  hoveredStyle?: StyleProp<ViewStyle>;
}

/**
 * Physical press: the control compresses under a finger, lifts slightly under a cursor,
 * and springs back rather than snapping. Shared by every glass control.
 */
export function PressableScale({
  children,
  scaleTo = 0.96,
  hoverLift = 1.5,
  style,
  hoveredStyle,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  disabled,
  ...props
}: PressableScaleProps): JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  const spring = (value: Animated.Value, toValue: number) => {
    Animated.spring(value, {
      toValue,
      damping: motion.press.damping,
      stiffness: motion.press.stiffness,
      mass: motion.press.mass,
      useNativeDriver: true
    }).start();
  };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      {...(Platform.OS === "web" ? { dataSet: { interactive: "true" } } : null)}
      onPressIn={(event) => {
        if (!disabled) {
          spring(scale, scaleTo);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        spring(scale, 1);
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        if (!disabled) {
          spring(lift, -hoverLift);
        }
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        spring(lift, 0);
        onHoverOut?.(event);
      }}
      style={({ hovered }) => [style, hovered ? hoveredStyle : null]}
    >
      <Animated.View style={{ transform: [{ scale }, { translateY: lift }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
