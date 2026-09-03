import { Platform, type ViewStyle } from "react-native";

import { darkColors, lightColors, type AppColors } from "@/theme/colors";
import { blur, duration, layout, motion, radius, spacing } from "@/theme/tokens";
import { fontFamily, typeScale, typography, type TypeVariant } from "@/theme/typography";
import type { ThemeMode } from "@/types/common";

export type ElevationLevel = "none" | "soft" | "panel" | "floating";

export type AppElevation = Record<ElevationLevel, ViewStyle>;

/**
 * Liquid Glass sits slightly above the content it refracts, so shadows stay wide,
 * soft, and low-contrast rather than dark drop shadows.
 */
const createElevation = (colors: AppColors): AppElevation => {
  if (Platform.OS === "web") {
    return {
      none: {},
      soft: { boxShadow: `0 4px 16px ${colors.shadow}` } as ViewStyle,
      panel: { boxShadow: `0 16px 40px ${colors.shadow}` } as ViewStyle,
      floating: { boxShadow: `0 24px 60px ${colors.shadow}` } as ViewStyle
    };
  }

  return {
    none: {},
    soft: {
      shadowColor: "#000000",
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3
    },
    panel: {
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8
    },
    floating: {
      shadowColor: "#000000",
      shadowOpacity: 0.26,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 18 },
      elevation: 16
    }
  };
};

export interface AppTheme {
  mode: Exclude<ThemeMode, "system">;
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  typeScale: typeof typeScale;
  fontFamily: string;
  blur: typeof blur;
  layout: typeof layout;
  duration: typeof duration;
  motion: typeof motion;
  elevation: AppElevation;
}

const themeCache = new Map<string, AppTheme>();

export const getTheme = (mode: Exclude<ThemeMode, "system">): AppTheme => {
  const cached = themeCache.get(mode);
  if (cached) {
    return cached;
  }

  const colors = mode === "dark" ? darkColors : lightColors;
  const theme: AppTheme = {
    mode,
    colors,
    spacing,
    radius,
    typography,
    typeScale,
    fontFamily,
    blur,
    layout,
    duration,
    motion,
    elevation: createElevation(colors)
  };
  themeCache.set(mode, theme);
  return theme;
};

export { blur, duration, fontFamily, layout, motion, radius, spacing, typeScale, typography };
export type { AppColors, TypeVariant };
