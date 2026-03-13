import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export function SectionHeader({ title, subtitle, rightSlot }: SectionHeaderProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  content: {
    flex: 1,
    gap: 2
  },
  title: {
    fontSize: 20,
    fontWeight: "700"
  },
  subtitle: {
    fontSize: 13
  }
});
