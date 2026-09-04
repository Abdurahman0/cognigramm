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
  /** The selection lens rendered as a bead of clear liquid, lit rather than tinted. */
  dropletCrown: string;
  dropletBody: string;
  dropletPool: string;
  dropletMeniscus: string;
  dropletCaustic: string;
  dropletGlint: string;
  dropletDepth: string;
  dropletRim: string;
  dropletShadow: string;
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
  shadow: "rgba(28, 24, 40, 0.16)",

  wallpaper: ["#FFE9F3", "#DCE7FF", "#FFF3DC"] as const,
  backdropBase: "#E9E6F2",
  backdropBloomWarm: "rgba(255, 143, 112, 0.45)",
  backdropBloomCool: "rgba(96, 148, 255, 0.42)",
  backdropVeil: "rgba(255, 255, 255, 0.30)",

  materialUltraThin: "rgba(255, 255, 255, 0.20)",
  materialThin: "rgba(255, 255, 255, 0.30)",
  materialRegular: "rgba(255, 255, 255, 0.42)",
  materialThick: "rgba(255, 255, 255, 0.92)",

  fillPrimary: "rgba(120, 120, 128, 0.20)",
  fillSecondary: "rgba(120, 120, 128, 0.16)",
  fillTertiary: "rgba(120, 120, 128, 0.12)",
  separator: "rgba(60, 60, 67, 0.18)",

  glass: "rgba(255, 255, 255, 0.42)",
  glassStrong: "rgba(255, 255, 255, 0.92)",
  glassSoft: "rgba(120, 120, 128, 0.12)",
  glassHover: "rgba(120, 120, 128, 0.18)",
  glassBorder: "rgba(255, 255, 255, 0.55)",
  selectionFill: "rgba(120, 120, 128, 0.16)",
  selectionRim: "rgba(255, 255, 255, 0.90)",
  raisedFill: "rgba(255, 255, 255, 0.72)",
  raisedTop: "rgba(255, 255, 255, 0.85)",
  raisedBottom: "rgba(118, 124, 150, 0.10)",
  raisedEdge: "rgba(255, 255, 255, 1)",
  raisedUnder: "rgba(112, 118, 145, 0.30)",
  raisedShadowNear: "rgba(80, 86, 115, 0.16)",
  raisedShadowFar: "rgba(80, 86, 115, 0.24)",
  dropletCrown: "rgba(255, 255, 255, 0.80)",
  dropletBody: "rgba(255, 255, 255, 0.24)",
  dropletPool: "rgba(255, 255, 255, 0.62)",
  dropletMeniscus: "rgba(255, 255, 255, 1)",
  dropletCaustic: "rgba(255, 255, 255, 0.92)",
  dropletGlint: "rgba(255, 255, 255, 0.95)",
  dropletDepth: "rgba(84, 88, 110, 0.32)",
  dropletRim: "rgba(104, 109, 134, 0.46)",
  dropletShadow: "rgba(66, 70, 94, 0.28)",
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
  messageOther: "rgba(120, 120, 128, 0.45)",
  overlay: "rgba(0, 0, 0, 0.55)",
  shadow: "rgba(0, 0, 0, 0.55)",

  wallpaper: ["#1B0A33", "#06184A", "#050510"] as const,
  backdropBase: "#07070B",
  backdropBloomWarm: "rgba(168, 62, 224, 0.42)",
  backdropBloomCool: "rgba(20, 110, 255, 0.40)",
  backdropVeil: "rgba(4, 4, 10, 0.34)",

  materialUltraThin: "rgba(255, 255, 255, 0.07)",
  materialThin: "rgba(20, 20, 26, 0.24)",
  materialRegular: "rgba(16, 16, 22, 0.34)",
  materialThick: "rgba(10, 10, 16, 0.90)",

  fillPrimary: "rgba(120, 120, 128, 0.36)",
  fillSecondary: "rgba(120, 120, 128, 0.28)",
  fillTertiary: "rgba(120, 120, 128, 0.20)",
  separator: "rgba(84, 84, 88, 0.50)",

  glass: "rgba(16, 16, 22, 0.34)",
  glassStrong: "rgba(10, 10, 16, 0.90)",
  glassSoft: "rgba(120, 120, 128, 0.20)",
  glassHover: "rgba(120, 120, 128, 0.30)",
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
  dropletCrown: "rgba(255, 255, 255, 0.26)",
  dropletBody: "rgba(255, 255, 255, 0.07)",
  dropletPool: "rgba(255, 255, 255, 0.20)",
  dropletMeniscus: "rgba(255, 255, 255, 0.92)",
  dropletCaustic: "rgba(255, 255, 255, 0.52)",
  dropletGlint: "rgba(255, 255, 255, 0.58)",
  dropletDepth: "rgba(0, 0, 0, 0.40)",
  dropletRim: "rgba(255, 255, 255, 0.30)",
  dropletShadow: "rgba(0, 0, 0, 0.50)",
  glassHighlight: "rgba(255, 255, 255, 0.35)",

  specularTop: "rgba(255, 255, 255, 0.55)",
  specularBottom: "rgba(0, 0, 0, 0.35)",

  sheenStrong: "rgba(255, 255, 255, 0.16)",
  sheenSoft: "rgba(255, 255, 255, 0.05)",
  sheenEdge: "rgba(255, 255, 255, 0.08)",

  blurTint: "dark"
};
