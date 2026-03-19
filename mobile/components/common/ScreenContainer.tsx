import type { PropsWithChildren } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
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
  const webContentStyle = Platform.OS === "web" ? styles.webContent : null;

  if (scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            webContentStyle,
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
          webContentStyle,
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
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  webContent: {
    alignSelf: "center",
    maxWidth: 480,
    width: "100%"
  }
});
