import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: keyof typeof Feather.glyphMap;
}

export function EmptyState({ title, description, icon = "inbox" }: EmptyStateProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.fillTertiary }]}>
        <Feather name={icon} size={26} color={theme.colors.textMuted} />
      </View>
      <AppText variant="title3" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="subhead" tone="secondary" style={styles.description}>
        {description}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    minHeight: 180,
    paddingHorizontal: 24,
    paddingVertical: 28
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 60,
    justifyContent: "center",
    marginBottom: 6,
    width: 60
  },
  title: {
    textAlign: "center"
  },
  description: {
    maxWidth: 320,
    textAlign: "center"
  }
});
