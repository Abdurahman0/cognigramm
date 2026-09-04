import type { StackNavigationOptions } from "@react-navigation/stack";
import type { Stack } from "expo-router";

import { GlassStack } from "@/components/navigation/GlassStack";
import {
  glassModalInterpolator,
  glassPushInterpolator,
  glassStackTransitionSpec
} from "@/components/navigation/stackTransition";
import type { StackScreenTransition } from "@/components/navigation/PlatformStack";

/**
 * Web half of the platform split. The options are written and checked against the
 * JavaScript stack, then cast once at the boundary so callers can keep using the
 * single set of types from the native file.
 */
export const PlatformStack = GlassStack as unknown as typeof Stack;

const transparentCard = { backgroundColor: "transparent" } as const;

const push: StackNavigationOptions = {
  // The JS stack defaults `animation` to "none" on web, which starts every card at its
  // resting position and skips the transition entirely. Naming a preset re-enables it;
  // the interpolator and spring below then replace the preset's own motion.
  animation: "default",
  cardStyle: transparentCard,
  cardStyleInterpolator: glassPushInterpolator,
  transitionSpec: glassStackTransitionSpec,
  // The interpolator dissolves the covered screen itself, so the stock dimming
  // overlay and card shadow would only muddy a translucent surface.
  cardOverlayEnabled: false,
  cardShadowEnabled: false,
  gestureEnabled: true,
  gestureDirection: "horizontal"
};

const modal: StackNavigationOptions = {
  ...push,
  presentation: "modal",
  cardStyleInterpolator: glassModalInterpolator,
  gestureDirection: "vertical"
};

export const pushTransition = push as unknown as StackScreenTransition;
export const modalTransition = modal as unknown as StackScreenTransition;
