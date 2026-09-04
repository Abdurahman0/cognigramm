import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface LiquidLensProps {
  radius: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The travelling selection marker, rendered as a bead of clear liquid.
 *
 * There is almost no tint: a drop of water is not a coloured shape, it is a lens, and
 * what you actually recognise is the light on it. So the bead is drawn from four cues —
 * a bright meniscus where the surface curves away at the top, a caustic along the bottom
 * where light bends through and focuses, a shaded band beneath the top edge that gives
 * it thickness, and a small glint where the light source reflects off the crown.
 *
 * Web draws all of that with one element's gradients and layered inset shadows; native
 * stacks the same cues as gradient views over a light blur, since `box-shadow` has no
 * multi-layer inset equivalent there.
 */
export function LiquidLens({ radius, style }: LiquidLensProps): JSX.Element {
  const { theme } = useAppTheme();
  const { colors } = theme;

  if (Platform.OS === "web") {
    return (
      <View
        pointerEvents="none"
        dataSet={{ droplet: "true" }}
        style={[styles.root, { borderRadius: radius }, style]}
      />
    );
  }

  return (
    <View pointerEvents="none" style={[styles.root, { borderRadius: radius }, style]}>
      <BlurView
        intensity={14}
        tint={theme.mode === "dark" ? "light" : "default"}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.clip]}
      >
        {/* Body: bright crown, clear middle, pooled light at the base. */}
        <LinearGradient
          colors={[colors.dropletCrown, colors.dropletBody, "transparent", colors.dropletPool]}
          locations={[0, 0.4, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Thickness: the bead shades the surface just under its top edge. */}
        <LinearGradient
          colors={[colors.dropletDepth, "transparent"]}
          locations={[0, 1]}
          style={[StyleSheet.absoluteFill, styles.depth]}
        />
        {/* Glint on the crown, caustic under the base. */}
        <LinearGradient
          colors={[colors.dropletGlint, "transparent"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.62, y: 0.72 }}
          style={[styles.glint, { borderRadius: radius }]}
        />
        <LinearGradient
          colors={["transparent", colors.dropletCaustic]}
          start={{ x: 0.4, y: 0.2 }}
          end={{ x: 0.86, y: 1 }}
          style={[styles.caustic, { borderRadius: radius }]}
        />
      </BlurView>

      {/* Meniscus and base rim: the two edges that actually catch the light. */}
      <View style={[styles.meniscus, { backgroundColor: colors.dropletMeniscus }]} />
      <View style={[styles.base, { backgroundColor: colors.dropletCaustic }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.rim,
          { borderRadius: radius, borderColor: colors.dropletRim }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "visible"
  },
  clip: {
    overflow: "hidden"
  },
  depth: {
    bottom: "62%"
  },
  glint: {
    height: "44%",
    left: "10%",
    position: "absolute",
    top: "8%",
    width: "46%"
  },
  caustic: {
    bottom: "4%",
    height: "40%",
    position: "absolute",
    right: "8%",
    width: "56%"
  },
  meniscus: {
    height: StyleSheet.hairlineWidth * 2,
    left: "14%",
    position: "absolute",
    right: "14%",
    top: 0
  },
  base: {
    bottom: 0,
    height: StyleSheet.hairlineWidth * 2,
    left: "22%",
    position: "absolute",
    opacity: 0.7,
    right: "22%"
  },
  rim: {
    borderWidth: StyleSheet.hairlineWidth
  }
});
