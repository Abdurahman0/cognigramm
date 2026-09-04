import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface LiquidLensProps {
  radius: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The travelling selection marker: a clear bead, and nothing more.
 *
 * An earlier pass lit it like a water drop, with a white meniscus, a caustic along the
 * base and a black inner shade. On the warm neutral palette that read as a chrome
 * lozenge rather than glass, so the shape now comes from the material alone — a faint
 * tint of the palette's own neutral, a hairline rim, and the blur behind it.
 */
export function LiquidLens({ radius, style }: LiquidLensProps): JSX.Element {
  const { theme } = useAppTheme();
  const { colors } = theme;

  if (Platform.OS === "web") {
    return (
      <View
        pointerEvents="none"
        dataSet={{ droplet: "true" }}
        style={[{ borderRadius: radius }, style]}
      />
    );
  }

  return (
    <View pointerEvents="none" style={[styles.clip, { borderRadius: radius }, style]}>
      <BlurView
        intensity={14}
        tint={theme.mode === "dark" ? "light" : "default"}
        style={StyleSheet.absoluteFill}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.dropletBody }]} />
      </BlurView>
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
  clip: {
    overflow: "hidden"
  },
  rim: {
    borderWidth: StyleSheet.hairlineWidth
  }
});
