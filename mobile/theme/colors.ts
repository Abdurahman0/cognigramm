export interface AppColors {
  /** Solid page background used as a fallback behind the glass backdrop. */
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
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

  /** Backdrop layers: base tone plus soft colour blooms behind the glass. */
  backdropBase: string;
  backdropBloomWarm: string;
  backdropBloomCool: string;
  backdropVeil: string;

  /** Translucent panel fills. `glass` is the default panel, `glassStrong` for headers/rails. */
  glass: string;
  glassStrong: string;
  glassSoft: string;
  glassHover: string;
  glassBorder: string;
  glassHighlight: string;

  /** Blur tint used by the optional native blur renderer. */
  blurTint: "light" | "dark";
}

export const lightColors: AppColors = {
  background: "#F3F0EB",
  surface: "#FFFFFF",
  surfaceMuted: "#F1ECE6",
  border: "rgba(28, 22, 18, 0.10)",
  textPrimary: "#1B1613",
  textSecondary: "#4E463F",
  textMuted: "#8A8078",
  accent: "#2F6BE8",
  accentMuted: "rgba(47, 107, 232, 0.12)",
  accentStrong: "#1F55C8",
  onAccent: "#FFFFFF",
  success: "#12A65C",
  warning: "#D97706",
  danger: "#E23D3D",
  dangerMuted: "rgba(226, 61, 61, 0.12)",
  online: "#12A65C",
  messageMine: "rgba(47, 107, 232, 0.95)",
  messageOther: "rgba(255, 255, 255, 0.82)",
  overlay: "rgba(24, 18, 14, 0.34)",
  shadow: "rgba(46, 34, 24, 0.18)",

  backdropBase: "#EDE8E1",
  backdropBloomWarm: "rgba(255, 206, 154, 0.55)",
  backdropBloomCool: "rgba(168, 195, 235, 0.50)",
  backdropVeil: "rgba(255, 255, 255, 0.34)",

  glass: "rgba(255, 255, 255, 0.62)",
  glassStrong: "rgba(255, 255, 255, 0.80)",
  glassSoft: "rgba(28, 22, 18, 0.045)",
  glassHover: "rgba(28, 22, 18, 0.075)",
  glassBorder: "rgba(28, 22, 18, 0.09)",
  glassHighlight: "rgba(255, 255, 255, 0.90)",

  blurTint: "light"
};

export const darkColors: AppColors = {
  background: "#151210",
  surface: "#2A2521",
  surfaceMuted: "#332D28",
  border: "rgba(255, 255, 255, 0.10)",
  textPrimary: "#F5F1EC",
  textSecondary: "#CFC7BF",
  textMuted: "#9A918A",
  accent: "#4C8DFF",
  accentMuted: "rgba(76, 141, 255, 0.18)",
  accentStrong: "#2F72F0",
  onAccent: "#FFFFFF",
  success: "#3ECF8E",
  warning: "#F5A524",
  danger: "#FF4D4F",
  dangerMuted: "rgba(255, 77, 79, 0.16)",
  online: "#38D57B",
  messageMine: "rgba(76, 141, 255, 0.88)",
  messageOther: "rgba(255, 255, 255, 0.085)",
  overlay: "rgba(8, 6, 5, 0.62)",
  shadow: "rgba(0, 0, 0, 0.45)",

  backdropBase: "#12100E",
  backdropBloomWarm: "rgba(126, 96, 68, 0.42)",
  backdropBloomCool: "rgba(56, 78, 104, 0.34)",
  backdropVeil: "rgba(10, 8, 7, 0.34)",

  glass: "rgba(64, 58, 52, 0.52)",
  glassStrong: "rgba(78, 71, 64, 0.60)",
  glassSoft: "rgba(255, 255, 255, 0.06)",
  glassHover: "rgba(255, 255, 255, 0.10)",
  glassBorder: "rgba(255, 255, 255, 0.09)",
  glassHighlight: "rgba(255, 255, 255, 0.14)",

  blurTint: "dark"
};
