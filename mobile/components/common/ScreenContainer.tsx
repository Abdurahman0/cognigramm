import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/useAppTheme";

interface ScreenContainerProps extends PropsWithChildren {
  scroll?: boolean;
  padded?: boolean;
  includeBottomInset?: boolean;
}

export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  includeBottomInset = true
}: ScreenContainerProps): JSX.Element {
  const { theme } = useAppTheme();
  const edges = includeBottomInset ? (["top", "bottom"] as const) : (["top"] as const);

  if (scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            padded && {
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.xxl
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.content,
          padded && {
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.lg
          }
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  scroll: {
    flex: 1
  },
  content: {
    flexGrow: 1
  }
});
