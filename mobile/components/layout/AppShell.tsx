import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { NavRail } from "@/components/layout/NavRail";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { GlassView } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";

interface AppShellProps {
  children: ReactNode;
  /** Hide the workspace sidebar for focused surfaces such as an active call. */
  showSidebar?: boolean;
}

/**
 * Desktop chrome: floating nav rail plus a single glass window that holds the
 * sidebar and whatever panes the current screen renders. Compact viewports keep
 * the plain stacked layout and rely on the floating tab bar instead.
 */
export function AppShell({ children, showSidebar = true }: AppShellProps): JSX.Element {
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();

  if (!isDesktop) {
    // A plain tint, deliberately without its own backdrop-filter: a filtered ancestor
    // would start a new backdrop root and starve the floating bars' blur of the content
    // scrolling beneath them.
    return (
      <View style={[styles.compactRoot, { backgroundColor: theme.colors.materialUltraThin }]}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.desktopRoot}>
      <NavRail />
      <GlassView
        material="regular"
        radius={theme.radius.sheet}
        highlight
        interactive
        elevation="floating"
        style={styles.window}
      >
        {showSidebar ? <WorkspaceSidebar /> : null}
        <View style={styles.content}>{children}</View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  compactRoot: {
    flex: 1
  },
  desktopRoot: {
    backgroundColor: "transparent",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  window: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
    padding: 10
  },
  content: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0
  }
});
