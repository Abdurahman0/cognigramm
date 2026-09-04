import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import { Platform } from "react-native";

/** Screen options shared by both stacks. Web supplies its own equivalents. */
export type StackScreenTransition = NativeStackNavigationOptions;

/**
 * The stack navigator for the current platform.
 *
 * Native gets the platform stack, which already animates. `PlatformStack.web.tsx`
 * swaps in the JavaScript stack for the browser, because the native stack's web
 * implementation only toggles `display` and lands every push as a hard cut.
 */
export const PlatformStack = Stack;

const isIOS = Platform.OS === "ios";

const transparentContent = { backgroundColor: "transparent" } as const;

export const pushTransition: StackScreenTransition = {
  presentation: "card",
  contentStyle: transparentContent,
  animation: isIOS ? "default" : "ios_from_right",
  animationDuration: 260,
  gestureEnabled: true,
  fullScreenGestureEnabled: isIOS,
  animationMatchesGesture: isIOS
};

export const modalTransition: StackScreenTransition = {
  presentation: "modal",
  contentStyle: transparentContent,
  animation: isIOS ? "default" : "fade_from_bottom",
  animationDuration: 300,
  gestureEnabled: true
};
