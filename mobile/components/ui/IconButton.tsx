import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Badge } from "@/components/ui/Badge";
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
  lg: { box: 46, icon: 20 },
  xl: { box: 58, icon: 24 }
};

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
    : theme.colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed, hovered }) => [
        styles.root,
        {
          width: dimensions.box,
          height: dimensions.box,
          borderRadius: dimensions.box / 2,
          backgroundColor: solidTone
            ? solidTone
            : active
            ? theme.colors.accentMuted
            : tone === "plain"
            ? hovered
              ? theme.colors.glassHover
              : "transparent"
            : hovered
            ? theme.colors.glassHover
            : theme.colors.glassSoft,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1
        },
        style
      ]}
    >
      <Feather name={icon} size={dimensions.icon} color={iconColor} />
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Badge count={badgeCount} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center"
  },
  badge: {
    position: "absolute",
    right: -4,
    top: -4
  }
});
