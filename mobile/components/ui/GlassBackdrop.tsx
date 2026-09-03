import { Platform, StyleSheet, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";

interface BloomProps {
  color: string;
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Soft colour bloom behind the glass. Web gets a real CSS blur through `[data-bloom]`;
 * native fakes the falloff with concentric rings of decreasing opacity.
 */
function Bloom({ color, size, top, bottom, left, right }: BloomProps): JSX.Element {
  const rings = Platform.OS === "web" ? [1] : [0.5, 0.72, 1];

  return (
    <View
      pointerEvents="none"
      style={[styles.bloomWrap, { width: size, height: size, top, bottom, left, right }]}
    >
      {rings.map((scale, index) => (
        <View
          key={`${scale}`}
          {...(Platform.OS === "web" ? { dataSet: { bloom: "true" } } : null)}
          style={{
            position: "absolute",
            top: (size * (1 - scale)) / 2,
            left: (size * (1 - scale)) / 2,
            width: size * scale,
            height: size * scale,
            borderRadius: (size * scale) / 2,
            backgroundColor: color,
            opacity: Platform.OS === "web" ? 1 : 0.34 - index * 0.08
          }}
        />
      ))}
    </View>
  );
}

/**
 * App-wide background: a warm base tone with two colour blooms and a veil, so every
 * translucent panel above it has something to actually blur.
 */
export function GlassBackdrop(): JSX.Element {
  const { theme } = useAppTheme();
  const { width, height } = useResponsive();
  const bloomSize = Math.max(width, height) * 0.85;

  return (
    <View pointerEvents="none" style={[styles.root, { backgroundColor: theme.colors.backdropBase }]}>
      <Bloom
        color={theme.colors.backdropBloomWarm}
        size={bloomSize}
        top={-bloomSize * 0.35}
        left={-bloomSize * 0.2}
      />
      <Bloom
        color={theme.colors.backdropBloomCool}
        size={bloomSize * 0.9}
        bottom={-bloomSize * 0.32}
        right={-bloomSize * 0.24}
      />
      <Bloom
        color={theme.colors.accentMuted}
        size={bloomSize * 0.7}
        top={height * 0.32}
        right={-bloomSize * 0.18}
      />
      <View style={[styles.veil, { backgroundColor: theme.colors.backdropVeil }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  bloomWrap: {
    position: "absolute"
  },
  veil: {
    ...StyleSheet.absoluteFillObject
  }
});
