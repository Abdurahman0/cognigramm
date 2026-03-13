import { darkColors, lightColors, type AppColors } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/tokens";
import type { ThemeMode } from "@/types/common";

export interface AppTheme {
  mode: Exclude<ThemeMode, "system">;
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

export const getTheme = (mode: Exclude<ThemeMode, "system">): AppTheme => ({
  mode,
  colors: mode === "dark" ? darkColors : lightColors,
  spacing,
  radius,
  typography
});
