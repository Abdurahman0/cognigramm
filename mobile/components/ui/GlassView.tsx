import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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

/** Native blur strength per material, roughly matching the CSS blur radii on web. */
const BLUR_INTENSITY: Record<Exclude<GlassMaterial, "clear">, number> = {
  ultraThin: 24,
  thin: 40,
  regular: 60,
  thick: 96
};

interface GlassViewProps extends PropsWithChildren<Pick<ViewProps, "pointerEvents" | "onLayout">> {
  material?: GlassMaterial;
  tone?: GlassTone;
  radius?: number;
  bordered?: boolean;
  /** Lens treatment: specular sheen across the surface plus a bevelled rim. */
  highlight?: boolean;
  /** Eases transform and shadow changes so hover and press feel physical. */
  interactive?: boolean;
  elevation?: ElevationLevel;
  style?: StyleProp<ViewStyle>;
}

/**
 * Liquid Glass surface.
 *
 * The tint is deliberately thin — the blur does the work, so whatever sits behind stays
 * readable through the surface. Native platforms blur with `expo-blur`; web uses the CSS
 * `backdrop-filter` from the injected `[data-glass]` rules. On top of the blur sit a
 * diagonal specular sheen and a bevelled rim, which is what makes it read as a lens
 * rather than a translucent rectangle.
 */
export function GlassView({
  children,
  material,
  tone = "panel",
  radius,
  bordered = true,
  highlight = false,
  interactive = false,
  elevation = "none",
  style,
  pointerEvents,
  onLayout
}: GlassViewProps): JSX.Element {
  const { theme } = useAppTheme();
  const resolved: GlassMaterial = material ?? TONE_TO_MATERIAL[tone];
  const cornerRadius = radius ?? theme.radius.xl;
  const isWeb = Platform.OS === "web";
  const isClear = resolved === "clear";

  const fill = isClear
    ? "transparent"
    : resolved === "ultraThin"
    ? theme.colors.materialUltraThin
    : resolved === "thin"
    ? theme.colors.materialThin
    : resolved === "thick"
    ? theme.colors.materialThick
    : theme.colors.materialRegular;

  const showLens = highlight && !isClear;

  return (
    <View
      onLayout={onLayout}
      pointerEvents={pointerEvents}
      {...(isWeb
        ? {
            dataSet: {
              glass: resolved,
              ...(showLens ? { lens: "true" } : null),
              ...(interactive ? { interactive: "true" } : null)
            }
          }
        : null)}
      style={[
        {
          borderRadius: cornerRadius,
          borderWidth: bordered ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: bordered ? theme.colors.glassBorder : "transparent",
          // Web paints the tint through the same node that carries backdrop-filter.
          backgroundColor: isWeb ? fill : "transparent"
        },
        theme.elevation[elevation],
        !isClear && styles.clip,
        style
      ]}
    >
      {!isWeb && !isClear ? (
        <>
          <BlurView
            pointerEvents="none"
            intensity={BLUR_INTENSITY[resolved]}
            tint={theme.colors.blurTint}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        </>
      ) : null}

      {showLens && !isWeb ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[theme.colors.sheenStrong, theme.colors.sheenSoft, "transparent", theme.colors.sheenEdge]}
            locations={[0, 0.28, 0.62, 1]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[styles.rimTop, { backgroundColor: theme.colors.specularTop }]} />
          <View
            pointerEvents="none"
            style={[styles.rimBottom, { backgroundColor: theme.colors.specularBottom }]}
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
  rimTop: {
    height: StyleSheet.hairlineWidth * 2,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  rimBottom: {
    bottom: 0,
    height: StyleSheet.hairlineWidth * 2,
    left: 0,
    position: "absolute",
    right: 0
  }
});
