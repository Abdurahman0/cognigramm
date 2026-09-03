import { StyleSheet, Switch, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface ToggleItemProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleItem({ title, description, value, onValueChange }: ToggleItemProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.colors.glassSoft, borderRadius: theme.radius.lg }
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.glassHover, true: theme.colors.accentMuted }}
        thumbColor={value ? theme.colors.accent : theme.colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  copy: {
    flex: 1,
    gap: 4,
    marginRight: 10
  },
  title: {
    fontSize: 15,
    fontWeight: "600"
  },
  description: {
    fontSize: 12,
    lineHeight: 17
  }
});
