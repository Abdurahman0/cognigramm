import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  leftSlot?: ReactNode;
  /** `large` is the iOS large-title header; `inline` is the compact nav-bar style. */
  variant?: "large" | "inline";
}

export function SectionHeader({
  title,
  subtitle,
  rightSlot,
  leftSlot,
  variant = "large"
}: SectionHeaderProps): JSX.Element {
  const isLarge = variant === "large";

  return (
    <View style={styles.row}>
      {leftSlot}
      <View style={styles.content}>
        <AppText variant={isLarge ? "largeTitle" : "headline"} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant={isLarge ? "subhead" : "caption1"} tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
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
    gap: 12,
    justifyContent: "space-between"
  },
  content: {
    flex: 1,
    gap: 2
  }
});
