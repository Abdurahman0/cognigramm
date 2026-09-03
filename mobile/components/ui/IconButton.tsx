import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAppTheme } from "@/hooks/useAppTheme";

export type IconName = React.ComponentProps<typeof Feather>["name"];
export type IconButtonTone = "neutral" | "accent" | "danger" | "success" | "plain";
export type IconButtonSize = "sm" | "md" | "lg" | "xl";

interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: IconButtonTone;
  size?: IconButtonSize;
  active?: boolean;
  disabled?: boolean;
  badgeCount?: number;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconButtonSize, { box: number; icon: number }> = {
  sm: { box: 30, icon: 15 },
  md: { box: 38, icon: 18 },
  lg: { box: 46, icon: 21 },
  xl: { box: 60, icon: 25 }
};

/** Circular glass control: capsule shape, specular rim, springy press. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "neutral",
  size = "md",
  active = false,
  disabled = false,
  badgeCount = 0,
  style
}: IconButtonProps): JSX.Element {
  const { theme } = useAppTheme();
  const dimensions = SIZES[size];

  const solidTone =
    tone === "danger"
      ? theme.colors.danger
      : tone === "success"
      ? theme.colors.success
      : tone === "accent"
      ? theme.colors.accent
      : null;

  const iconColor = solidTone
    ? theme.colors.onAccent
    : active
    ? theme.colors.accent
    : theme.colors.textPrimary;

  const background = solidTone
    ? solidTone
    : active
    ? theme.colors.accentMuted
    : tone === "plain"
    ? "transparent"
    : theme.colors.materialUltraThin;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.pressable, { opacity: disabled ? 0.4 : 1 }, style]}
    >
      <View
        {...(Platform.OS === "web" && !solidTone && tone !== "plain"
          ? { dataSet: { glass: "thin" } }
          : null)}
        style={[
          styles.circle,
          {
            width: dimensions.box,
            height: dimensions.box,
            borderRadius: dimensions.box / 2,
            backgroundColor: background,
            borderColor: solidTone ? "transparent" : theme.colors.glassBorder,
            borderWidth: tone === "plain" ? 0 : StyleSheet.hairlineWidth * 2
          },
          solidTone ? theme.elevation.soft : null
        ]}
      >
        <Feather name={icon} size={dimensions.icon} color={iconColor} />
      </View>
      {badgeCount > 0 ? (
        <View style={styles.badge} pointerEvents="none">
          <Badge count={badgeCount} />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center"
  },
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  badge: {
    position: "absolute",
    right: -6,
    top: -4
  }
});
