import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { motion } from "@/theme";

interface RaisedCardProps
  extends PropsWithChildren<
    Pick<PressableProps, "accessibilityRole" | "accessibilityLabel" | "accessibilityState" | "disabled">
  > {
  onPress?: () => void;
  /** Selected row: the card keeps the accent tint and stays lifted. */
  active?: boolean;
  radius?: number;
  /** Layout for the content row inside the card. */
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

type Surface = "rest" | "hovered" | "pressed";

/**
 * A list row as a solid object rather than a tinted stripe.
 *
 * What reads as depth is consistent lighting: a bright bevel along the top edge where
 * the face catches the light, a gradient falling off down the card, a shaded underside,
 * and two shadows — a tight contact shadow plus a wider soft one for the gap it floats
 * above. Hovering lifts it and lengthens the shadow; pressing sinks it and turns the
 * bevel inside out, so the light moves underneath the way it does on a real button.
 */
export function RaisedCard({
  children,
  onPress,
  active = false,
  radius,
  contentStyle,
  style,
  disabled,
  ...accessibility
}: RaisedCardProps): JSX.Element {
  const { theme } = useAppTheme();
  const [surface, setSurface] = useState<Surface>("rest");
  const lift = useRef(new Animated.Value(0)).current;

  const cornerRadius = radius ?? theme.radius.lg;
  const isWeb = Platform.OS === "web";

  const springTo = (toValue: number) => {
    Animated.spring(lift, {
      toValue,
      damping: motion.press.damping,
      stiffness: motion.press.stiffness,
      mass: motion.press.mass,
      useNativeDriver: true
    }).start();
  };

  // Native cannot transition a shadow, so it steps between the elevation presets while
  // the travel itself stays on the spring.
  const nativeShadow =
    surface === "pressed"
      ? theme.elevation.none
      : surface === "hovered"
      ? theme.elevation.panel
      : theme.elevation.soft;

  return (
    <Pressable
      {...accessibility}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        setSurface("pressed");
        springTo(1);
      }}
      onPressOut={() => {
        setSurface("rest");
        springTo(0);
      }}
      onHoverIn={() => {
        if (!disabled) {
          setSurface("hovered");
          springTo(-2);
        }
      }}
      onHoverOut={() => {
        setSurface("rest");
        springTo(0);
      }}
      style={style}
    >
      {/* Two layers on purpose: a shadow and `overflow: hidden` cannot share a view on
          native — iOS drops the shadow entirely and Android clips it — so the outer view
          casts and the inner one clips. */}
      <Animated.View
        style={[
          { borderRadius: cornerRadius, transform: [{ translateY: lift }] },
          !isWeb && nativeShadow
        ]}
      >
        <View
          {...(isWeb ? { dataSet: { raised: surface } } : null)}
          style={[
            styles.card,
            {
              borderRadius: cornerRadius,
              backgroundColor: active ? theme.colors.accentMuted : theme.colors.raisedFill
            },
            contentStyle
          ]}
        >
          {!isWeb ? (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={[theme.colors.raisedTop, "transparent", theme.colors.raisedBottom]}
                locations={[0, 0.46, 1]}
                style={[StyleSheet.absoluteFill, { borderRadius: cornerRadius }]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.bevel,
                  styles.bevelTop,
                  { backgroundColor: surface === "pressed" ? theme.colors.raisedUnder : theme.colors.raisedEdge }
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.bevel,
                  styles.bevelBottom,
                  { backgroundColor: surface === "pressed" ? theme.colors.raisedEdge : theme.colors.raisedUnder }
                ]}
              />
            </>
          ) : null}
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden"
  },
  bevel: {
    height: StyleSheet.hairlineWidth * 2,
    left: 0,
    position: "absolute",
    right: 0
  },
  bevelTop: {
    top: 0
  },
  bevelBottom: {
    bottom: 0
  }
});
