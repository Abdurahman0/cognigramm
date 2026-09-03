import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import type { ElevationLevel } from "@/theme";

export type GlassTone = "panel" | "strong" | "soft" | "clear";

interface GlassViewProps extends PropsWithChildren<Pick<ViewProps, "pointerEvents" | "onLayout">> {
  tone?: GlassTone;
  radius?: number;
  bordered?: boolean;
  /** Hairline light reflection along the top edge, like a real glass sheet. */
  highlight?: boolean;
  elevation?: ElevationLevel;
  style?: StyleProp<ViewStyle>;
}

/**
 * Translucent surface. On web the matching CSS `backdrop-filter` comes from the
 * injected `[data-glass]` rules; native platforms fall back to layered translucency,
 * which reads the same over the animated backdrop.
 */
export function GlassView({
  children,
  tone = "panel",
  radius,
  bordered = true,
  highlight = false,
  elevation = "none",
  style,
  pointerEvents,
  onLayout
}: GlassViewProps): JSX.Element {
  const { theme } = useAppTheme();
  const cornerRadius = radius ?? theme.radius.xl;

  const fill =
    tone === "strong"
      ? theme.colors.glassStrong
      : tone === "soft"
      ? theme.colors.glassSoft
      : tone === "clear"
      ? "transparent"
      : theme.colors.glass;

  const webBlurTone = tone === "strong" ? "strong" : tone === "soft" ? "soft" : tone === "clear" ? "none" : "panel";

  return (
    <View
      onLayout={onLayout}
      pointerEvents={pointerEvents}
      {...(Platform.OS === "web" ? { dataSet: { glass: webBlurTone } } : null)}
      style={[
        {
          backgroundColor: fill,
          borderRadius: cornerRadius,
          borderWidth: bordered ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: bordered ? theme.colors.glassBorder : "transparent"
        },
        theme.elevation[elevation],
        highlight && styles.clip,
        style
      ]}
    >
      {highlight ? (
        <View
          pointerEvents="none"
          style={[styles.highlight, { backgroundColor: theme.colors.glassHighlight }]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden"
  },
  highlight: {
    height: 1,
    left: 0,
    opacity: 0.6,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1
  }
});
