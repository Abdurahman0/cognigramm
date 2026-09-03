import { Platform, useWindowDimensions } from "react-native";

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1080,
  wide: 1440
} as const;

export interface ResponsiveState {
  width: number;
  height: number;
  isWeb: boolean;
  /** Phone-sized viewport: single pane, floating tab bar. */
  isCompact: boolean;
  /** Tablet-sized viewport: single pane with wider gutters. */
  isTablet: boolean;
  /** Multi-pane layout: nav rail + sidebar + list + detail. */
  isDesktop: boolean;
  isWide: boolean;
  isLandscape: boolean;
}

export const useResponsive = (): ResponsiveState => {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;

  return {
    width,
    height,
    isWeb: Platform.OS === "web",
    isCompact: width < BREAKPOINTS.tablet,
    isTablet: width >= BREAKPOINTS.tablet && !isDesktop,
    isDesktop,
    isWide: width >= BREAKPOINTS.wide,
    isLandscape: width > height
  };
};
