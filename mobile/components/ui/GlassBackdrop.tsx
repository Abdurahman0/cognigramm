import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useResponsive } from "@/hooks/useResponsive";

interface BloomProps {
  color: string;
  size: number;
  x: number;
  y: number;
}

/** A colour blob in the wallpaper. Blur needs structure behind it or it reads as flat paint. */
function Bloom({ color, size, x, y }: BloomProps): JSX.Element {
  const rings = Platform.OS === "web" ? [1] : [0.5, 0.75, 1];

  return (
    <View pointerEvents="none" style={[styles.bloomWrap, { width: size, height: size, left: x, top: y }]}>
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
            opacity: Platform.OS === "web" ? 1 : 0.45 - index * 0.12
          }}
        />
      ))}
    </View>
  );
}

/**
 * The wallpaper every glass surface refracts. Several overlapping colour blobs at
 * different scales give the blur something to smear; a flat gradient would look
 * identical blurred or not.
 */
export function GlassBackdrop(): JSX.Element {
  const { theme } = useAppTheme();
  const { width, height } = useResponsive();
  const unit = Math.max(width, height);

  const blobs: BloomProps[] = [
    { color: theme.colors.backdropBloomWarm, size: unit * 0.62, x: -unit * 0.12, y: -unit * 0.18 },
    { color: theme.colors.backdropBloomCool, size: unit * 0.58, x: width * 0.52, y: height * 0.08 },
    { color: theme.colors.backdropBloomWarm, size: unit * 0.44, x: width * 0.18, y: height * 0.42 },
    { color: theme.colors.backdropBloomWarm, size: unit * 0.36, x: width * 0.68, y: height * 0.58 },
    { color: theme.colors.backdropBloomCool, size: unit * 0.3, x: -unit * 0.06, y: height * 0.72 }
  ];

  return (
    <View pointerEvents="none" style={styles.root}>
      <LinearGradient
        colors={[...theme.colors.wallpaper]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {blobs.map((blob, index) => (
        <Bloom key={index} {...blob} />
      ))}
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
