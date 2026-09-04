import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

import { motion, transition } from "@/theme";

/** The interpolator signature is not exported by name, so it is read off the options. */
type SceneStyleInterpolator = NonNullable<BottomTabNavigationOptions["sceneStyleInterpolator"]>;

/** Keeps the shift proportional on phones without letting it run away on a wide window. */
const shiftFor = (width: number): number =>
  Math.max(16, Math.min(44, width * transition.tabShift));

/**
 * Scene transition for the tab navigator.
 *
 * `progress` is -1 for scenes to the left of the active tab, 0 for the active one and
 * 1 for scenes to the right. Mapping it directly gives a transition that knows which
 * way you travelled: the arriving scene slides in from the side you came from while
 * the leaving one slides out the other way, and both settle from slightly small so
 * the glass reads as rising toward you rather than cross-dissolving in place.
 *
 * The distance is taken in points rather than as a percentage because this animation
 * runs on the native driver on device, and that only interpolates numbers.
 */
export const createGlassTabSceneInterpolator =
  (width: number): SceneStyleInterpolator =>
  ({ current }) => {
    const shift = shiftFor(width);

    return {
      sceneStyle: {
        opacity: current.progress.interpolate({
          inputRange: [-1, -0.5, 0, 0.5, 1],
          outputRange: [0, 0, 1, 0, 0]
        }),
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-shift, 0, shift]
            })
          },
          {
            scale: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [transition.tabScale, 1, transition.tabScale]
            })
          }
        ]
      }
    };
  };

/** Springs the scene across rather than easing it, so the change carries weight. */
export const glassTabTransitionSpec = {
  animation: "spring",
  config: {
    damping: motion.screen.damping,
    stiffness: motion.screen.stiffness,
    mass: motion.screen.mass,
    overshootClamping: true
  }
} as const;
