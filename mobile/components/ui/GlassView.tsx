import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import type { ElevationLevel } from "@/theme";

export type GlassMaterial = "ultraThin" | "thin" | "regular" | "thick" | "clear";
/** Legacy tone names, mapped onto the material stack. */
export type GlassTone = "panel" | "strong" | "soft" | "clear";

const TONE_TO_MATERIAL: Record<GlassTone, GlassMaterial> = {
  panel: "regular",
  strong: "thick",
  soft: "ultraThin",
  clear: "clear"
};

interface GlassViewProps extends PropsWithChildren<Pick<ViewProps, "pointerEvents" | "onLayout">> {
  material?: GlassMaterial;
  tone?: GlassTone;
  radius?: number;
  bordered?: boolean;
  /** Specular rim: bright lens edge on top, faint refraction underneath. */
  highlight?: boolean;
  elevation?: ElevationLevel;
  style?: StyleProp<ViewStyle>;
}

/**
 * A Liquid Glass surface. On web the CSS `backdrop-filter` from `[data-glass]` does the
 * lensing; native platforms approximate it with layered translucency over the wallpaper.
 */
export function GlassView({
  children,
  material,
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
  const resolved: GlassMaterial = material ?? TONE_TO_MATERIAL[tone];
  const cornerRadius = radius ?? theme.radius.xl;

  const fill =
    resolved === "ultraThin"
      ? theme.colors.materialUltraThin
      : resolved === "thin"
      ? theme.colors.materialThin
      : resolved === "thick"
      ? theme.colors.materialThick
      : resolved === "clear"
      ? "transparent"
      : theme.colors.materialRegular;

  return (
    <View
      onLayout={onLayout}
      pointerEvents={pointerEvents}
      {...(Platform.OS === "web" ? { dataSet: { glass: resolved } } : null)}
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
        <>
          <View
            pointerEvents="none"
            style={[styles.specularTop, { backgroundColor: theme.colors.specularTop }]}
          />
          <View
            pointerEvents="none"
            style={[styles.specularBottom, { backgroundColor: theme.colors.specularBottom }]}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden"
  },
  specularTop: {
    height: 1,
    left: 0,
    opacity: 0.85,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1
  },
  specularBottom: {
    bottom: 0,
    height: 1,
    left: 0,
    opacity: 0.6,
    position: "absolute",
    right: 0,
    zIndex: 1
  }
});
