import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Platform, StyleSheet, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { motion } from "@/theme";

interface GlassSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const TRACK_WIDTH = 74;
const TRACK_HEIGHT = 34;
const THUMB_WIDTH = 44;
/** The lens overhangs the track slightly, so it reads as a separate piece of glass. */
const THUMB_OVERHANG = 3;
const THUMB_HEIGHT = TRACK_HEIGHT + THUMB_OVERHANG * 2;
const TRAVEL = TRACK_WIDTH - THUMB_WIDTH;

/**
 * Capsule toggle built from the Liquid Glass material.
 *
 * The thumb is a wide glass lens that overhangs the track and refracts the tinted fill
 * beneath it. Tapping springs it across; pressing and dragging hands it to the finger,
 * so it follows your thumb and settles on whichever side you release nearest — the same
 * grab-and-scrub behaviour as the nav indicator.
 */
export function GlassSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel
}: GlassSwitchProps): JSX.Element {
  const { theme } = useAppTheme();
  const trackRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const pressed = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);
  const progressValue = useRef(value ? 1 : 0);
  /** Page-space left edge of the track, so a drag can be mapped from absolute x. */
  const trackLeft = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const changeRef = useRef(onValueChange);
  changeRef.current = onValueChange;

  useEffect(() => {
    const id = progress.addListener(({ value: current }) => {
      progressValue.current = current;
    });
    return () => {
      progress.removeListener(id);
    };
  }, [progress]);

  const springProgress = useRef((to: number, withStretch: boolean) => {
    Animated.parallel([
      Animated.spring(progress, {
        toValue: to,
        damping: motion.press.damping,
        stiffness: motion.press.stiffness,
        mass: motion.press.mass,
        useNativeDriver: true
      }),
      withStretch
        ? Animated.sequence([
            Animated.timing(stretch, { toValue: 1.14, duration: 110, useNativeDriver: true }),
            Animated.spring(stretch, {
              toValue: 1,
              damping: 14,
              stiffness: 260,
              mass: 0.7,
              useNativeDriver: true
            })
          ])
        : Animated.spring(stretch, {
            toValue: 1,
            damping: 16,
            stiffness: 280,
            mass: 0.7,
            useNativeDriver: true
          })
    ]).start();
  }).current;

  useEffect(() => {
    if (dragging.current) {
      return;
    }
    springProgress(value ? 1 : 0, true);
  }, [springProgress, value]);

  // react-native-web's Pressable handles Enter but not Space, which is the canonical
  // key for role="switch", so the DOM node gets its own listener.
  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const node = trackRef.current as unknown as HTMLElement | null;
    if (!node) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        if (!disabledRef.current) {
          changeRef.current(!valueRef.current);
        }
      }
    };
    node.addEventListener("keydown", handleKey);
    return () => {
      node.removeEventListener("keydown", handleKey);
    };
  }, []);

  const setPressed = useRef((active: boolean) => {
    Animated.spring(pressed, {
      toValue: active ? 1 : 0,
      damping: 24,
      stiffness: 380,
      mass: 0.6,
      useNativeDriver: true
    }).start();
  }).current;

  // One gesture owns both interactions: a short press toggles, a drag scrubs. Splitting
  // them across a Pressable and a PanResponder does not work — whichever element takes
  // the responder on pointer-down keeps it for the rest of the gesture.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: () => {
          setPressed(true);
        },
        onPanResponderMove: (_event, gesture) => {
          if (Math.abs(gesture.dx) <= 3) {
            return;
          }
          dragging.current = true;
          // locationX is relative to whatever child is under the finger, so the drag is
          // mapped from absolute page x against the measured track instead.
          const x = gesture.moveX - trackLeft.current - THUMB_WIDTH / 2;
          progress.setValue(Math.max(0, Math.min(1, x / TRAVEL)));
          stretch.setValue(1.1);
        },
        onPanResponderRelease: (_event, gesture) => {
          setPressed(false);
          const wasDragging = dragging.current;
          dragging.current = false;

          if (!wasDragging && Math.abs(gesture.dx) <= 3) {
            changeRef.current(!valueRef.current);
            return;
          }

          const landed = progressValue.current > 0.5;
          springProgress(landed ? 1 : 0, false);
          if (landed !== valueRef.current) {
            changeRef.current(landed);
          }
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          setPressed(false);
          springProgress(valueRef.current ? 1 : 0, false);
        }
      }),
    [progress, setPressed, springProgress, stretch]
  );

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });
  // Held or in flight, the lens pulls along its path and thins slightly.
  const thumbScaleX = Animated.multiply(
    stretch,
    pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })
  );
  const thumbScaleY = stretch.interpolate({
    inputRange: [1, 1.14],
    outputRange: [1, 0.96],
    extrapolate: "clamp"
  });

  return (
    <View
      ref={trackRef}
      accessible
      focusable={!disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      {...panResponder.panHandlers}
      {...(Platform.OS === "web"
        ? { dataSet: { interactive: "true" }, "aria-checked": value, tabIndex: disabled ? -1 : 0 }
        : null)}
      style={[styles.pressable, disabled && styles.disabled]}
      onLayout={() => {
        trackRef.current?.measureInWindow((x) => {
          trackLeft.current = x;
        });
      }}
    >
      <View style={styles.track}>
        {/* The tinted fill is its own rounded layer. Nothing clips the lens — clipping
            was what drew a hard straight edge across the thumb. */}
        <View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: theme.colors.fillSecondary }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: theme.colors.success, opacity: progress }]}
        />

        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX }, { scaleX: thumbScaleX }, { scaleY: thumbScaleY }] }
          ]}
        >
          <View
            {...(Platform.OS === "web" ? { dataSet: { glass: "thin" } } : null)}
            style={[
              styles.thumbGlass,
              theme.elevation.soft,
              {
                backgroundColor: theme.colors.materialThin,
                borderColor: theme.colors.specularTop
              }
            ]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[theme.colors.sheenStrong, "transparent", theme.colors.sheenEdge]}
              locations={[0, 0.55, 1]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.thumbSheen]}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    cursor: "pointer",
    justifyContent: "center",
    paddingVertical: THUMB_OVERHANG,
    userSelect: "none"
  },
  disabled: {
    cursor: "auto",
    opacity: 0.5
  },
  track: {
    height: TRACK_HEIGHT,
    justifyContent: "center",
    width: TRACK_WIDTH
  },
  fill: {
    borderRadius: TRACK_HEIGHT / 2,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  thumb: {
    height: THUMB_HEIGHT,
    left: 0,
    position: "absolute",
    top: -THUMB_OVERHANG,
    width: THUMB_WIDTH
  },
  thumbGlass: {
    borderRadius: THUMB_HEIGHT / 2,
    borderWidth: 1,
    height: "100%",
    overflow: "hidden",
    width: "100%"
  },
  thumbSheen: {
    borderRadius: THUMB_HEIGHT / 2
  }
});
