import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { GlassView } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";

interface WorkspacePaneProps {
  children: ReactNode;
  /** Fixed-width list column on desktop; omit for the flexible detail column. */
  width?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One column inside the desktop glass window. On compact viewports the pane
 * collapses to a plain full-width container so mobile layouts stay flat.
 */
export function WorkspacePane({ children, width, style }: WorkspacePaneProps): JSX.Element {
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();

  if (!isDesktop) {
    return <View style={[styles.compact, style]}>{children}</View>;
  }

  return (
    <GlassView
      tone="soft"
      radius={theme.radius.xxl}
      bordered={false}
      style={[
        styles.pane,
        width
          ? {
              flexBasis: width,
              flexGrow: 0,
              maxWidth: theme.layout.listPaneMaxWidth,
              minWidth: theme.layout.listPaneMinWidth
            }
          : styles.flexible,
        style
      ]}
    >
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  compact: {
    backgroundColor: "transparent",
    flex: 1,
    minWidth: 0
  },
  pane: {
    overflow: "hidden"
  },
  flexible: {
    flex: 1,
    minWidth: 0
  }
});
