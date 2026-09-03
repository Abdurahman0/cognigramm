/**
 * Apple-flavoured palette: system colours, label/fill opacity tiers, and the
 * Liquid Glass material stack (ultraThin -> thick) that floats above the wallpaper.
 */
export interface AppColors {
  /** Solid page background used as a fallback behind the wallpaper. */
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;

  /** Label tiers, mirroring UIColor.label / secondaryLabel / tertiaryLabel. */
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;

  accent: string;
  accentMuted: string;
  accentStrong: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  dangerMuted: string;
  online: string;

  messageMine: string;
  messageOther: string;
  overlay: string;
  shadow: string;

  /** Wallpaper: base tone plus the colour blooms the glass refracts. */
  backdropBase: string;
  backdropBloomWarm: string;
  backdropBloomCool: string;
  backdropVeil: string;

  /** Liquid Glass materials, thinnest to thickest. */
  materialUltraThin: string;
  materialThin: string;
  materialRegular: string;
  materialThick: string;

  /** Non-material fills for rows, chips, and pressed states. */
  fillPrimary: string;
  fillSecondary: string;
  fillTertiary: string;
  separator: string;

  /** Legacy aliases kept so older call sites stay valid. */
  glass: string;
  glassStrong: string;
  glassSoft: string;
  glassHover: string;
  glassBorder: string;
  glassHighlight: string;

  /** Lens edges: bright specular rim on top, dim refraction underneath. */
  specularTop: string;
  specularBottom: string;

  blurTint: "light" | "dark";
}

export const lightColors: AppColors = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  surfaceMuted: "#F2F2F7",
  border: "rgba(60, 60, 67, 0.29)",

  textPrimary: "#000000",
  textSecondary: "rgba(60, 60, 67, 0.60)",
  textMuted: "rgba(60, 60, 67, 0.40)",
  textFaint: "rgba(60, 60, 67, 0.22)",

  accent: "#007AFF",
  accentMuted: "rgba(0, 122, 255, 0.14)",
  accentStrong: "#0060DF",
  onAccent: "#FFFFFF",
  success: "#34C759",
  warning: "#FF9500",
  danger: "#FF3B30",
  dangerMuted: "rgba(255, 59, 48, 0.14)",
  online: "#34C759",

  messageMine: "#007AFF",
  messageOther: "rgba(120, 120, 128, 0.20)",
  overlay: "rgba(0, 0, 0, 0.28)",
  shadow: "rgba(28, 24, 40, 0.16)",

  backdropBase: "#E9E6F2",
  backdropBloomWarm: "rgba(255, 196, 168, 0.62)",
  backdropBloomCool: "rgba(150, 182, 255, 0.60)",
  backdropVeil: "rgba(255, 255, 255, 0.20)",

  materialUltraThin: "rgba(255, 255, 255, 0.48)",
  materialThin: "rgba(255, 255, 255, 0.62)",
  materialRegular: "rgba(255, 255, 255, 0.74)",
  materialThick: "rgba(255, 255, 255, 0.86)",

  fillPrimary: "rgba(120, 120, 128, 0.20)",
  fillSecondary: "rgba(120, 120, 128, 0.16)",
  fillTertiary: "rgba(120, 120, 128, 0.12)",
  separator: "rgba(60, 60, 67, 0.18)",

  glass: "rgba(255, 255, 255, 0.74)",
  glassStrong: "rgba(255, 255, 255, 0.86)",
  glassSoft: "rgba(120, 120, 128, 0.12)",
  glassHover: "rgba(120, 120, 128, 0.18)",
  glassBorder: "rgba(255, 255, 255, 0.55)",
  glassHighlight: "rgba(255, 255, 255, 0.95)",

  specularTop: "rgba(255, 255, 255, 0.90)",
  specularBottom: "rgba(255, 255, 255, 0.28)",

  blurTint: "light"
};

export const darkColors: AppColors = {
  background: "#000000",
  surface: "#1C1C1E",
  surfaceMuted: "#2C2C2E",
  border: "rgba(84, 84, 88, 0.65)",

  textPrimary: "#FFFFFF",
  textSecondary: "rgba(235, 235, 245, 0.60)",
  textMuted: "rgba(235, 235, 245, 0.40)",
  textFaint: "rgba(235, 235, 245, 0.22)",

  accent: "#0A84FF",
  accentMuted: "rgba(10, 132, 255, 0.22)",
  accentStrong: "#409CFF",
  onAccent: "#FFFFFF",
  success: "#30D158",
  warning: "#FF9F0A",
  danger: "#FF453A",
  dangerMuted: "rgba(255, 69, 58, 0.20)",
  online: "#30D158",

  messageMine: "#0A84FF",
  messageOther: "rgba(120, 120, 128, 0.38)",
  overlay: "rgba(0, 0, 0, 0.55)",
  shadow: "rgba(0, 0, 0, 0.55)",

  backdropBase: "#07070B",
  backdropBloomWarm: "rgba(122, 74, 168, 0.55)",
  backdropBloomCool: "rgba(28, 88, 178, 0.55)",
  backdropVeil: "rgba(4, 4, 8, 0.30)",

  materialUltraThin: "rgba(120, 120, 128, 0.18)",
  materialThin: "rgba(44, 44, 48, 0.52)",
  materialRegular: "rgba(36, 36, 40, 0.66)",
  materialThick: "rgba(24, 24, 28, 0.82)",

  fillPrimary: "rgba(120, 120, 128, 0.36)",
  fillSecondary: "rgba(120, 120, 128, 0.28)",
  fillTertiary: "rgba(120, 120, 128, 0.20)",
  separator: "rgba(84, 84, 88, 0.50)",

  glass: "rgba(36, 36, 40, 0.66)",
  glassStrong: "rgba(24, 24, 28, 0.82)",
  glassSoft: "rgba(120, 120, 128, 0.20)",
  glassHover: "rgba(120, 120, 128, 0.30)",
  glassBorder: "rgba(255, 255, 255, 0.14)",
  glassHighlight: "rgba(255, 255, 255, 0.35)",

  specularTop: "rgba(255, 255, 255, 0.42)",
  specularBottom: "rgba(255, 255, 255, 0.08)",

  blurTint: "dark"
};
