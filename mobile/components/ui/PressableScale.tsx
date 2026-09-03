import type { PropsWithChildren } from "react";
import { useRef } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

interface PressableScaleProps extends PropsWithChildren<Omit<PressableProps, "style" | "children">> {
  /** How far the control shrinks while held. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  hoveredStyle?: StyleProp<ViewStyle>;
}

/**
 * Controls on Apple platforms compress slightly under a finger and spring back.
 * Wraps Pressable so any glass control gets that feel.
 */
export function PressableScale({
  children,
  scaleTo = 0.96,
  style,
  hoveredStyle,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: PressableScaleProps): JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 26,
      stiffness: 420,
      mass: 0.7,
      useNativeDriver: true
    }).start();
  };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) {
          animateTo(scaleTo);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      style={({ hovered }) => [style, hovered ? hoveredStyle : null]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
