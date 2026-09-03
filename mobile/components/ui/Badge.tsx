import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

export type BadgeTone = "accent" | "danger" | "muted" | "success";

interface BadgeProps {
  count?: number;
  label?: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ count, label, tone = "accent", style }: BadgeProps): JSX.Element | null {
  const { theme } = useAppTheme();
  const text = label ?? (typeof count === "number" ? (count > 99 ? "99+" : `${count}`) : "");

  if (!text) {
    return null;
  }

  const background =
    tone === "danger"
      ? theme.colors.danger
      : tone === "success"
      ? theme.colors.success
      : tone === "muted"
      ? theme.colors.glassSoft
      : theme.colors.accent;

  const color = tone === "muted" ? theme.colors.textSecondary : theme.colors.onAccent;

  return (
    <View style={[styles.root, { backgroundColor: background }, style]}>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderRadius: 999,
    height: 21,
    justifyContent: "center",
    minWidth: 21,
    paddingHorizontal: 7
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1
  }
});
