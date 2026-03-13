import { StyleSheet, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface LoadingSkeletonProps {
  rows?: number;
}

export function LoadingSkeleton({ rows = 4 }: LoadingSkeletonProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={styles.root}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    height: 74
  }
});
