import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import type { IconName } from "@/components/ui/IconButton";

interface ChipProps {
  label: string;
  active?: boolean;
  icon?: IconName;
  count?: number;
  onPress?: () => void;
}

export function Chip({ label, active = false, icon, count, onPress }: ChipProps): JSX.Element {
  const { theme } = useAppTheme();
  const textColor = active ? theme.colors.onAccent : theme.colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.root,
        {
          backgroundColor: active
            ? theme.colors.accent
            : hovered
            ? theme.colors.glassHover
            : theme.colors.glassSoft,
          opacity: pressed ? 0.85 : 1
        }
      ]}
    >
      {icon ? <Feather name={icon} size={13} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      {typeof count === "number" && count > 0 ? (
        <View
          style={[
            styles.count,
            { backgroundColor: active ? "rgba(255,255,255,0.24)" : theme.colors.glassHover }
          ]}
        >
          <Text style={[styles.countLabel, { color: textColor }]}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 13
  },
  label: {
    fontSize: 13,
    fontWeight: "600"
  },
  count: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  countLabel: {
    fontSize: 11,
    fontWeight: "700"
  }
});
