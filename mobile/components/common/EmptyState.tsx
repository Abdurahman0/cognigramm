import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { GlassView } from "@/components/ui/GlassView";
import { useAppTheme } from "@/hooks/useAppTheme";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: keyof typeof Feather.glyphMap;
}

export function EmptyState({ title, description, icon = "inbox" }: EmptyStateProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <GlassView tone="soft" radius={theme.radius.xl} bordered={false} style={styles.root}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.glassSoft }]}>
        <Feather name={icon} size={22} color={theme.colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>{description}</Text>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    minHeight: 180,
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  title: {
    fontSize: 16,
    fontWeight: "700"
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 320,
    textAlign: "center"
  }
});
