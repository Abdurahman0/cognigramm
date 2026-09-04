import type { StackCardStyleInterpolator, TransitionPreset } from "@react-navigation/stack";
import { Animated } from "react-native";

import { motion, transition } from "@/theme";

type StackTransitionSpec = TransitionPreset["transitionSpec"];

/**
 * Combines "how far this card has arrived" (0 → 1) with "how far it is being covered"
 * (1 → 2) into a single 0..2 track, which is how the stock interpolators handle a card
 * that is both entering and being pushed over.
 */
const trackFor = (
  current: { progress: Animated.AnimatedInterpolation<number> },
  next?: { progress: Animated.AnimatedInterpolation<number> }
): Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number> =>
  next
    ? Animated.add(
        current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
        next.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" })
      )
    : current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });

/**
 * Push transition.
 *
 * Every screen in this app is transparent over one shared wallpaper, so a full-width
 * iOS slide would leave both screens legible on top of each other mid-transition.
 * Instead the arriving screen slides a short way in from the trailing edge while it
 * resolves, and the one it covers parallaxes back and dissolves — the sense of depth
 * survives, and only one screen is ever readable at a time.
 */
export const glassPushInterpolator: StackCardStyleInterpolator = ({
  current,
  next,
  inverted,
  layouts: { screen }
}) => {
  const track = trackFor(current, next);
  const travel = screen.width * 0.34;

  return {
    cardStyle: {
      opacity: track.interpolate({
        inputRange: [0, 0.4, 1, 1.4, 2],
        outputRange: [0, 0.55, 1, 0.35, 0],
        extrapolate: "clamp"
      }),
      transform: [
        {
          translateX: Animated.multiply(
            track.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [travel, 0, -screen.width * transition.cardParallax],
              extrapolate: "clamp"
            }),
            inverted
          )
        },
        {
          scale: track.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [0.97, 1, 0.94],
            extrapolate: "clamp"
          })
        }
      ]
    }
  };
};

/**
 * Modal transition: the sheet rises from the bottom edge while the screen it covers
 * settles back, so the modal reads as a pane lifting off the page.
 */
export const glassModalInterpolator: StackCardStyleInterpolator = ({
  current,
  next,
  layouts: { screen }
}) => {
  const track = trackFor(current, next);

  return {
    cardStyle: {
      opacity: track.interpolate({
        inputRange: [0, 0.5, 1, 1.5, 2],
        outputRange: [0, 0.7, 1, 0.3, 0],
        extrapolate: "clamp"
      }),
      transform: [
        {
          translateY: track.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [screen.height * 0.16, 0, -screen.height * 0.04],
            extrapolate: "clamp"
          })
        },
        {
          scale: track.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [0.96, 1, 0.94],
            extrapolate: "clamp"
          })
        }
      ]
    }
  };
};

/** Screens travel on the same spring as the rest of the material, just heavier. */
export const glassStackTransitionSpec: StackTransitionSpec = {
  open: {
    animation: "spring",
    config: {
      damping: motion.screen.damping,
      stiffness: motion.screen.stiffness,
      mass: motion.screen.mass,
      overshootClamping: true,
      restDisplacementThreshold: 0.4,
      restSpeedThreshold: 0.4
    }
  },
  close: {
    animation: "spring",
    config: {
      damping: motion.screen.damping,
      stiffness: motion.screen.stiffness + 60,
      mass: motion.screen.mass,
      overshootClamping: true,
      restDisplacementThreshold: 0.4,
      restSpeedThreshold: 0.4
    }
  }
};
