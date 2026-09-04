import {
  createStackNavigator,
  type StackNavigationEventMap,
  type StackNavigationOptions
} from "@react-navigation/stack";
import type { ParamListBase, StackNavigationState } from "@react-navigation/native";
import { withLayoutContext } from "expo-router";

const { Navigator } = createStackNavigator();

/**
 * Animated stack for the web build.
 *
 * `expo-router`'s default `Stack` is the native stack, whose web implementation just
 * toggles `display` between screens — every push and pop lands as a hard cut. This is
 * the JavaScript stack instead, which runs real card transitions (and a drag-back
 * gesture) in the browser. Native keeps the platform stack, so this file is only ever
 * pulled in by the `.web` layouts.
 */
export const GlassStack = withLayoutContext<
  StackNavigationOptions,
  typeof Navigator,
  StackNavigationState<ParamListBase>,
  StackNavigationEventMap
>(Navigator);
