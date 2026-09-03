import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
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
      ? theme.colors.fillSecondary
      : theme.colors.accent;

  return (
    <View style={[styles.root, { backgroundColor: background }, style]}>
      <AppText
        variant="caption2"
        color={tone === "muted" ? theme.colors.textSecondary : theme.colors.onAccent}
        numberOfLines={1}
        style={styles.label}
      >
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 6
  },
  label: {
    fontWeight: "600"
  }
});
