import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { motion } from "@/theme";

interface VolumeSliderProps {
  /** 0..1 */
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  /** Why the control is inert, shown in place of the percentage. */
  disabledReason?: string;
  accessibilityLabel?: string;
}

const TRACK_HEIGHT = 10;
const KNOB = 26;
/** Arrow keys and the accessibility actions move by this much. */
const STEP = 0.05;

/**
 * Output level for the call, dragged like a real fader.
 *
 * The knob follows the finger across the measured track, the filled portion grows
 * behind it, and the speaker glyph gains bars as the level rises, so the state reads
 * without looking at the number.
 */
export function VolumeSlider({
  value,
  onChange,
  disabled = false,
  disabledReason,
  accessibilityLabel = "Call volume"
}: VolumeSliderProps): JSX.Element {
  const { theme } = useAppTheme();
  const trackRef = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const progress = useRef(new Animated.Value(value)).current;
  const valueRef = useRef(value);
  valueRef.current = value;
  const widthRef = useRef(0);
  widthRef.current = width;
  const trackLeft = useRef(0);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const dragging = useRef(false);

  useEffect(() => {
    if (dragging.current) {
      return;
    }
    Animated.spring(progress, {
      toValue: value,
      damping: motion.press.damping,
      stiffness: motion.press.stiffness,
      mass: motion.press.mass,
      useNativeDriver: false
    }).start();
  }, [progress, value]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: () => {
          dragging.current = true;
        },
        onPanResponderMove: (_event, gesture) => {
          if (widthRef.current <= 0) {
            return;
          }
          // locationX is relative to whichever child is under the finger, so the drag is
          // mapped from absolute page x against the measured track.
          const next = (gesture.moveX - trackLeft.current) / widthRef.current;
          const clamped = Math.max(0, Math.min(1, next));
          progress.setValue(clamped);
          changeRef.current(clamped);
        },
        onPanResponderRelease: () => {
          dragging.current = false;
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        }
      }),
    [progress]
  );

  // Arrow keys are how a slider is expected to work from the keyboard.
  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const node = trackRef.current as unknown as HTMLElement | null;
    if (!node) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (disabledRef.current) {
        return;
      }
      const delta =
        event.key === "ArrowRight" || event.key === "ArrowUp"
          ? STEP
          : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -STEP
          : 0;
      if (delta === 0) {
        return;
      }
      event.preventDefault();
      changeRef.current(Math.max(0, Math.min(1, valueRef.current + delta)));
    };
    node.addEventListener("keydown", handleKey);
    return () => {
      node.removeEventListener("keydown", handleKey);
    };
  }, []);

  const percent = Math.round(value * 100);
  const icon = disabled || value === 0 ? "volume-x" : value < 0.34 ? "volume" : value < 0.72 ? "volume-1" : "volume-2";
  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });
  const knobLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, width - KNOB)]
  });

  return (
    <View style={[styles.root, disabled && styles.disabled]}>
      <Feather name={icon} size={18} color={theme.colors.textSecondary} />

      <View
        ref={trackRef}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        accessibilityState={{ disabled }}
        {...panResponder.panHandlers}
        {...(Platform.OS === "web"
          ? { tabIndex: disabled ? -1 : 0, "aria-valuenow": percent, dataSet: { interactive: "true" } }
          : null)}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          trackRef.current?.measureInWindow((x) => {
            trackLeft.current = x;
          });
        }}
        style={styles.trackArea}
      >
        <View style={[styles.track, { backgroundColor: theme.colors.fillSecondary }]}>
          <Animated.View
            style={[styles.fill, { backgroundColor: theme.colors.accent, width: fillWidth }]}
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.knob,
            theme.elevation.soft,
            {
              backgroundColor: theme.colors.materialThick,
              borderColor: theme.colors.specularTop,
              transform: [{ translateX: knobLeft }]
            }
          ]}
        />
      </View>

      <AppText variant="caption1" tone="tertiary" style={styles.readout} numberOfLines={1}>
        {disabled ? disabledReason ?? "Unavailable" : `${percent}%`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  disabled: {
    opacity: 0.5
  },
  trackArea: {
    flex: 1,
    height: KNOB,
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as const) : null)
  },
  track: {
    borderRadius: 999,
    height: TRACK_HEIGHT,
    overflow: "hidden",
    width: "100%"
  },
  fill: {
    height: "100%"
  },
  knob: {
    borderRadius: 999,
    borderWidth: 1,
    height: KNOB,
    left: 0,
    position: "absolute",
    width: KNOB
  },
  readout: {
    minWidth: 40,
    textAlign: "right"
  }
});
