import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated } from "react-native";

import { motion } from "@/theme";

export interface IndicatorSlot {
  /** Offset of the slot along the travel axis. */
  start: number;
  /** Length of the slot along the travel axis. */
  size: number;
}

interface MorphingIndicator {
  /** Fixed footprint of the pill; scale does the resizing so it can run on the GPU. */
  size: number;
  ready: boolean;
  style: {
    transform: (
      | { translateX: Animated.AnimatedInterpolation<number> }
      | { translateY: Animated.AnimatedInterpolation<number> }
      | { scaleX: Animated.AnimatedInterpolation<number> }
      | { scaleY: Animated.AnimatedInterpolation<number> }
    )[];
    opacity: Animated.Value;
  };
  /** Follow a finger: the pill tracks the position directly and stays stretched. */
  dragTo: (position: number) => void;
  /** Let go: the pill springs to the given slot and relaxes. */
  release: (index: number) => void;
  /** Slot nearest a position, for deciding what a drag lands on. */
  slotAt: (position: number) => number;
}

/**
 * Drives a single indicator that travels between nav slots instead of each item
 * lighting up on its own.
 *
 * Tapping springs the pill to the new slot, stretching along the direction of travel —
 * more for longer jumps — then settling. Holding and dragging hands control to the
 * finger: the pill follows continuously, stays stretched while it moves, and snaps to
 * whichever slot it is released over. Position and size are both transforms, so the
 * whole thing stays on the native driver.
 */
export const useMorphingIndicator = (
  activeIndex: number,
  slots: IndicatorSlot[],
  axis: "x" | "y" = "x"
): MorphingIndicator => {
  const center = useRef(new Animated.Value(0)).current;
  const ratio = useRef(new Animated.Value(1)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const previousCenter = useRef<number | null>(null);
  const liveCenter = useRef<number | null>(null);
  const dragging = useRef(false);
  const lastDragPosition = useRef(0);
  /** Set when a tap or drag-release already started the spring for that slot. */
  const handledIndex = useRef<number | null>(null);

  // Track where the pill actually is, so a release springs with the distance it still
  // has to cover rather than assuming it starts from the last committed slot.
  useEffect(() => {
    const id = center.addListener(({ value }) => {
      liveCenter.current = value;
    });
    return () => {
      center.removeListener(id);
    };
  }, [center]);

  const maxSize = useMemo(
    () => slots.reduce((largest, slot) => Math.max(largest, slot.size), 0),
    [slots]
  );

  const springTo = useCallback(
    (target: IndicatorSlot, travelled: number) => {
      const overshoot = 1 + Math.min(travelled / 320, 0.3);
      Animated.parallel([
        Animated.spring(center, {
          toValue: target.start + target.size / 2,
          damping: motion.enter.damping,
          stiffness: motion.enter.stiffness,
          mass: motion.enter.mass,
          useNativeDriver: true
        }),
        Animated.spring(ratio, {
          toValue: target.size / maxSize,
          damping: motion.enter.damping,
          stiffness: motion.enter.stiffness,
          mass: motion.enter.mass,
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.timing(stretch, { toValue: overshoot, duration: 130, useNativeDriver: true }),
          Animated.spring(stretch, {
            toValue: 1,
            damping: 13,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: true
          })
        ])
      ]).start();
    },
    [center, maxSize, ratio, stretch]
  );

  useEffect(() => {
    const target = slots[activeIndex];
    if (!target || maxSize <= 0 || dragging.current) {
      return;
    }

    const nextCenter = target.start + target.size / 2;

    // The interaction already launched this spring; re-running it here would restart
    // the animation with no travel and flatten the stretch.
    if (handledIndex.current === activeIndex) {
      handledIndex.current = null;
      previousCenter.current = nextCenter;
      return;
    }
    const travelled = previousCenter.current === null ? 0 : Math.abs(nextCenter - previousCenter.current);
    const firstPlacement = previousCenter.current === null;
    previousCenter.current = nextCenter;

    if (firstPlacement) {
      center.setValue(nextCenter);
      ratio.setValue(target.size / maxSize);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      return;
    }

    springTo(target, travelled);
  }, [activeIndex, center, maxSize, opacity, ratio, slots, springTo]);

  const slotAt = useCallback(
    (position: number) => {
      if (slots.length === 0) {
        return activeIndex;
      }
      let nearest = 0;
      let smallest = Number.POSITIVE_INFINITY;
      slots.forEach((slot, index) => {
        const distance = Math.abs(slot.start + slot.size / 2 - position);
        if (distance < smallest) {
          smallest = distance;
          nearest = index;
        }
      });
      return nearest;
    },
    [activeIndex, slots]
  );

  const dragTo = useCallback(
    (position: number) => {
      if (slots.length === 0 || maxSize <= 0) {
        return;
      }
      const first = slots[0];
      const last = slots[slots.length - 1];
      if (!first || !last) {
        return;
      }

      const min = first.start + first.size / 2;
      const max = last.start + last.size / 2;
      const clamped = Math.max(min, Math.min(max, position));
      const speed = Math.abs(clamped - lastDragPosition.current);
      lastDragPosition.current = clamped;

      if (!dragging.current) {
        dragging.current = true;
        // A held pill puffs up slightly, the way a lens lifts off the glass.
        Animated.spring(stretch, {
          toValue: 1.12,
          damping: 18,
          stiffness: 300,
          mass: 0.7,
          useNativeDriver: true
        }).start();
      }

      center.setValue(clamped);
      // Faster scrubbing smears the pill further along its path.
      stretch.setValue(1.12 + Math.min(speed / 90, 0.22));

      const hovered = slots[slotAt(clamped)];
      if (hovered) {
        ratio.setValue(hovered.size / maxSize);
      }
    },
    [center, maxSize, ratio, slotAt, slots, stretch]
  );

  const release = useCallback(
    (index: number) => {
      dragging.current = false;
      const target = slots[index];
      if (!target) {
        return;
      }
      const nextCenter = target.start + target.size / 2;
      const from = liveCenter.current ?? previousCenter.current ?? nextCenter;
      previousCenter.current = nextCenter;
      handledIndex.current = index;
      springTo(target, Math.abs(nextCenter - from));
    },
    [slots, springTo]
  );

  const translate = Animated.subtract(center, maxSize / 2).interpolate({
    inputRange: [-1, 1],
    outputRange: [-1, 1]
  });
  const along = Animated.multiply(ratio, stretch).interpolate({
    inputRange: [0, 4],
    outputRange: [0, 4]
  });
  // Counter-squash across the travel axis: the pill thins as it stretches.
  const across = stretch.interpolate({
    inputRange: [1, 1.34],
    outputRange: [1, 0.88],
    extrapolate: "clamp"
  });

  return {
    size: maxSize,
    ready: maxSize > 0,
    style: {
      transform:
        axis === "x"
          ? [{ translateX: translate }, { scaleX: along }, { scaleY: across }]
          : [{ translateY: translate }, { scaleY: along }, { scaleX: across }],
      opacity
    },
    dragTo,
    release,
    slotAt
  };
};
