import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: keyof typeof Feather.glyphMap;
}

export function EmptyState({ title, description, icon = "inbox" }: EmptyStateProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Feather name={icon} size={22} color={theme.colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 180,
    paddingHorizontal: 24
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  title: {
    fontSize: 16,
    fontWeight: "700"
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center"
  }
});
