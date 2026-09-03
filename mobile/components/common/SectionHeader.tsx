import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  leftSlot?: ReactNode;
}

export function SectionHeader({ title, subtitle, rightSlot, leftSlot }: SectionHeaderProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={styles.row}>
      {leftSlot}
      <View style={styles.content}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  content: {
    flex: 1,
    gap: 2
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  subtitle: {
    fontSize: 13
  }
});
