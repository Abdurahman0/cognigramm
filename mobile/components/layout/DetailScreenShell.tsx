import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppShell } from "@/components/layout/AppShell";
import { WorkspacePane } from "@/components/layout/WorkspacePane";
import { useResponsive } from "@/hooks/useResponsive";

interface DetailScreenShellProps {
  children: ReactNode;
  /** Keeps long forms and detail pages readable on wide screens. */
  maxWidth?: number;
}

/**
 * Chrome for stack screens that live outside the tab navigator: the desktop glass
 * window with rail and sidebar, a plain safe area on compact viewports.
 */
export function DetailScreenShell({ children, maxWidth = 860 }: DetailScreenShellProps): JSX.Element {
  const { isDesktop } = useResponsive();

  if (!isDesktop) {
    return (
      <SafeAreaView edges={["top"]} style={styles.mobileRoot}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <AppShell>
      <View style={styles.desktopRoot}>
        <WorkspacePane style={[styles.pane, { maxWidth }]}>{children}</WorkspacePane>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    backgroundColor: "transparent",
    flex: 1
  },
  desktopRoot: {
    backgroundColor: "transparent",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    minWidth: 0
  },
  pane: {
    alignSelf: "center",
    width: "100%"
  }
});
