import { Platform, type ViewStyle } from "react-native";

import { darkColors, lightColors, type AppColors } from "@/theme/colors";
import { blur, duration, layout, radius, spacing, typography } from "@/theme/tokens";
import type { ThemeMode } from "@/types/common";

export type ElevationLevel = "none" | "soft" | "panel" | "floating";

export type AppElevation = Record<ElevationLevel, ViewStyle>;

/**
 * Shadows are expressed as CSS box-shadows on web (crisper, supports large blur radii)
 * and as native shadow/elevation props everywhere else.
 */
const createElevation = (colors: AppColors): AppElevation => {
  if (Platform.OS === "web") {
    return {
      none: {},
      soft: { boxShadow: `0 6px 18px ${colors.shadow}` } as ViewStyle,
      panel: { boxShadow: `0 18px 46px ${colors.shadow}` } as ViewStyle,
      floating: { boxShadow: `0 28px 70px ${colors.shadow}` } as ViewStyle
    };
  }

  return {
    none: {},
    soft: {
      shadowColor: "#000000",
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4
    },
    panel: {
      shadowColor: "#000000",
      shadowOpacity: 0.24,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10
    },
    floating: {
      shadowColor: "#000000",
      shadowOpacity: 0.32,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 18
    }
  };
};

export interface AppTheme {
  mode: Exclude<ThemeMode, "system">;
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  blur: typeof blur;
  layout: typeof layout;
  duration: typeof duration;
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
    blur,
    layout,
    duration,
    elevation: createElevation(colors)
  };
  themeCache.set(mode, theme);
  return theme;
};

export { blur, duration, layout, radius, spacing, typography };
export type { AppColors };
