import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";

interface ScreenContainerProps extends PropsWithChildren {
  scroll?: boolean;
  padded?: boolean;
  includeBottomInset?: boolean;
  /** Centres content and caps its width. Detail pages use this on wide viewports. */
  maxWidth?: number;
}

export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  includeBottomInset = true,
  maxWidth
}: ScreenContainerProps): JSX.Element {
  const { theme } = useAppTheme();
  const { isCompact } = useResponsive();
  const edges = includeBottomInset ? (["top", "bottom"] as const) : (["top"] as const);
  const constrainStyle = maxWidth ? { alignSelf: "center" as const, width: "100%" as const, maxWidth } : null;
  const paddingStyle = padded
    ? {
        paddingHorizontal: isCompact ? theme.spacing.lg : theme.spacing.xl
      }
    : null;

  if (scroll) {
    return (
      <SafeAreaView edges={edges} style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            constrainStyle,
            paddingStyle,
            padded && { paddingBottom: theme.spacing.xxl }
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
    <SafeAreaView edges={edges} style={styles.safe}>
      <View
        style={[
          styles.content,
          constrainStyle,
          paddingStyle,
          padded && { paddingBottom: theme.spacing.lg }
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "transparent",
    flex: 1
  },
  scroll: {
    flex: 1
  },
  content: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  }
});
