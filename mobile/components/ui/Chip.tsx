import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import type { IconName } from "@/components/ui/IconButton";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ChipProps {
  label: string;
  active?: boolean;
  icon?: IconName;
  count?: number;
  onPress?: () => void;
}

/** Capsule filter control; the selected chip lifts onto tinted glass. */
export function Chip({ label, active = false, icon, count, onPress }: ChipProps): JSX.Element {
  const { theme } = useAppTheme();
  const textColor = active ? theme.colors.onAccent : theme.colors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      {...(Platform.OS === "web" && !active ? { dataSet: { glass: "thin" } } : null)}
      style={({ pressed, hovered }) => [
        styles.root,
        {
          backgroundColor: active
            ? theme.colors.accent
            : hovered
            ? theme.colors.fillSecondary
            : theme.colors.materialUltraThin,
          borderColor: active ? "transparent" : theme.colors.glassBorder,
          opacity: pressed ? 0.8 : 1
        },
        active ? theme.elevation.soft : null
      ]}
    >
      {icon ? <Feather name={icon} size={13} color={textColor} /> : null}
      <AppText variant="subheadEmphasized" color={textColor}>
        {label}
      </AppText>
      {typeof count === "number" && count > 0 ? (
        <View
          style={[
            styles.count,
            {
              backgroundColor: active ? "rgba(255, 255, 255, 0.26)" : theme.colors.fillTertiary
            }
          ]}
        >
          <AppText variant="caption2" color={textColor}>
            {count > 99 ? "99+" : count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    overflow: "hidden",
    paddingHorizontal: 14
  },
  count: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1
  }
});
