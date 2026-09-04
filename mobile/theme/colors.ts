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

  /** Wallpaper: gradient stops plus the colour blooms the glass refracts. */
  wallpaper: readonly [string, string, string];
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
  /** Fill and rim of the travelling selection lens in the tab bar and nav rail. */
  selectionFill: string;
  selectionRim: string;
  /** Raised list cards: a lit top bevel, a shaded underside, and the shadow they cast. */
  raisedFill: string;
  raisedTop: string;
  raisedBottom: string;
  raisedEdge: string;
  raisedUnder: string;
  raisedShadowNear: string;
  raisedShadowFar: string;
  /** The selection lens: a clear bead, drawn with the palette's own neutrals. */
  dropletBody: string;
  dropletRim: string;
  glassHighlight: string;

  /** Lens edges: bright specular rim on top, dim refraction underneath. */
  specularTop: string;
  specularBottom: string;

  /** Diagonal sheen sweeping across a glass surface. */
  sheenStrong: string;
  sheenSoft: string;
  sheenEdge: string;

  blurTint: "light" | "dark";
}

export const lightColors: AppColors = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  surfaceMuted: "#F2F2F7",
  border: "rgba(60, 60, 67, 0.29)",

  textPrimary: "#000000",
  textSecondary: "rgba(60, 60, 67, 0.72)",
  textMuted: "rgba(60, 60, 67, 0.40)",
  textFaint: "rgba(60, 60, 67, 0.22)",

  accent: "#007AFF",
  accentMuted: "rgba(0, 122, 255, 0.20)",
  accentStrong: "#0060DF",
  onAccent: "#FFFFFF",
  success: "#34C759",
  warning: "#FF9500",
  danger: "#FF3B30",
  dangerMuted: "rgba(255, 59, 48, 0.14)",
  online: "#34C759",

  messageMine: "#007AFF",
  messageOther: "rgba(255, 255, 255, 0.55)",
  overlay: "rgba(0, 0, 0, 0.28)",
  shadow: "rgba(46, 36, 26, 0.16)",

  wallpaper: ["#F6EEE4", "#EFE5D9", "#FAF5EE"] as const,
  backdropBase: "#EFE8DE",
  backdropBloomWarm: "rgba(214, 168, 118, 0.42)",
  backdropBloomCool: "rgba(178, 158, 136, 0.36)",
  backdropVeil: "rgba(255, 255, 255, 0.30)",

  materialUltraThin: "rgba(255, 255, 255, 0.20)",
  materialThin: "rgba(255, 255, 255, 0.30)",
  materialRegular: "rgba(255, 255, 255, 0.42)",
  materialThick: "rgba(255, 255, 255, 0.92)",

  fillPrimary: "rgba(150, 132, 112, 0.20)",
  fillSecondary: "rgba(150, 132, 112, 0.16)",
  fillTertiary: "rgba(150, 132, 112, 0.12)",
  separator: "rgba(78, 66, 54, 0.18)",

  glass: "rgba(255, 255, 255, 0.42)",
  glassStrong: "rgba(255, 255, 255, 0.92)",
  glassSoft: "rgba(150, 132, 112, 0.12)",
  glassHover: "rgba(150, 132, 112, 0.18)",
  glassBorder: "rgba(255, 255, 255, 0.55)",
  selectionFill: "rgba(150, 132, 112, 0.16)",
  selectionRim: "rgba(255, 255, 255, 0.90)",
  raisedFill: "rgba(255, 253, 250, 0.72)",
  raisedTop: "rgba(255, 255, 255, 0.85)",
  raisedBottom: "rgba(148, 128, 106, 0.10)",
  raisedEdge: "rgba(255, 255, 255, 1)",
  raisedUnder: "rgba(140, 122, 100, 0.30)",
  raisedShadowNear: "rgba(96, 80, 62, 0.16)",
  raisedShadowFar: "rgba(96, 80, 62, 0.24)",
  dropletBody: "rgba(150, 132, 112, 0.22)",
  dropletRim: "rgba(126, 110, 90, 0.34)",
  glassHighlight: "rgba(255, 255, 255, 0.95)",

  specularTop: "rgba(255, 255, 255, 0.95)",
  specularBottom: "rgba(28, 24, 40, 0.10)",

  sheenStrong: "rgba(255, 255, 255, 0.55)",
  sheenSoft: "rgba(255, 255, 255, 0.18)",
  sheenEdge: "rgba(255, 255, 255, 0.22)",

  blurTint: "light"
};

export const darkColors: AppColors = {
  background: "#000000",
  surface: "#1C1C1E",
  surfaceMuted: "#2C2C2E",
  border: "rgba(84, 84, 88, 0.65)",

  textPrimary: "#FFFFFF",
  textSecondary: "rgba(235, 235, 245, 0.72)",
  textMuted: "rgba(235, 235, 245, 0.40)",
  textFaint: "rgba(235, 235, 245, 0.22)",

  accent: "#0A84FF",
  accentMuted: "rgba(10, 132, 255, 0.30)",
  accentStrong: "#409CFF",
  onAccent: "#FFFFFF",
  success: "#30D158",
  warning: "#FF9F0A",
  danger: "#FF453A",
  dangerMuted: "rgba(255, 69, 58, 0.20)",
  online: "#30D158",

  messageMine: "#0A84FF",
  messageOther: "rgba(154, 148, 140, 0.34)",
  overlay: "rgba(0, 0, 0, 0.55)",
  shadow: "rgba(0, 0, 0, 0.55)",

  wallpaper: ["#343029", "#26231F", "#161514"] as const,
  backdropBase: "#161514",
  backdropBloomWarm: "rgba(172, 138, 100, 0.22)",
  backdropBloomCool: "rgba(122, 116, 108, 0.24)",
  backdropVeil: "rgba(16, 15, 14, 0.36)",

  materialUltraThin: "rgba(255, 252, 248, 0.06)",
  materialThin: "rgba(44, 41, 38, 0.26)",
  materialRegular: "rgba(38, 36, 33, 0.38)",
  materialThick: "rgba(30, 28, 26, 0.90)",

  fillPrimary: "rgba(154, 148, 140, 0.30)",
  fillSecondary: "rgba(154, 148, 140, 0.22)",
  fillTertiary: "rgba(154, 148, 140, 0.15)",
  separator: "rgba(118, 112, 105, 0.46)",

  glass: "rgba(38, 36, 33, 0.38)",
  glassStrong: "rgba(30, 28, 26, 0.90)",
  glassSoft: "rgba(154, 148, 140, 0.15)",
  glassHover: "rgba(154, 148, 140, 0.24)",
  glassBorder: "rgba(255, 255, 255, 0.14)",
  selectionFill: "rgba(255, 255, 255, 0.10)",
  selectionRim: "rgba(255, 255, 255, 0.22)",
  raisedFill: "rgba(255, 255, 255, 0.05)",
  raisedTop: "rgba(255, 255, 255, 0.10)",
  raisedBottom: "rgba(0, 0, 0, 0.18)",
  raisedEdge: "rgba(255, 255, 255, 0.26)",
  raisedUnder: "rgba(0, 0, 0, 0.60)",
  raisedShadowNear: "rgba(0, 0, 0, 0.45)",
  raisedShadowFar: "rgba(0, 0, 0, 0.55)",
  dropletBody: "rgba(255, 252, 248, 0.14)",
  dropletRim: "rgba(255, 252, 248, 0.24)",
  glassHighlight: "rgba(255, 255, 255, 0.35)",

  specularTop: "rgba(255, 255, 255, 0.55)",
  specularBottom: "rgba(0, 0, 0, 0.35)",

  sheenStrong: "rgba(255, 255, 255, 0.16)",
  sheenSoft: "rgba(255, 255, 255, 0.05)",
  sheenEdge: "rgba(255, 255, 255, 0.08)",

  blurTint: "dark"
};
