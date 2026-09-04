export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36
} as const;

/**
 * Apple leans on continuous corners: controls are capsules, cards use large radii,
 * and nested corners stay concentric (outer radius - padding).
 */
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 26,
  /** Grouped list container / floating panel. */
  panel: 30,
  /** Sheets and the outer desktop window. */
  sheet: 34,
  pill: 999
} as const;

/** Backdrop blur strength per material tier. */
export const blur = {
  ultraThin: 20,
  thin: 30,
  regular: 40,
  thick: 84,
  soft: 20,
  panel: 40,
  strong: 84
} as const;

export const layout = {
  railWidth: 76,
  sidebarWidth: 268,
  listPaneWidth: 376,
  listPaneMinWidth: 320,
  listPaneMaxWidth: 430,
  detailMaxWidth: 880,
  authMaxWidth: 420,
  tabBarHeight: 64,
  /** Space a scroll view leaves so content can pass under the floating tab bar. */
  tabBarClearance: 104,
  /** Minimum comfortable touch target. */
  hitTarget: 44
} as const;

export const duration = {
  fast: 140,
  base: 240,
  slow: 360
} as const;

/** Spring presets matching the springy, slightly overshooting iOS feel. */
export const motion = {
  press: { damping: 26, stiffness: 420, mass: 0.7 },
  enter: { damping: 22, stiffness: 260, mass: 0.9 },
  /** Scene changes: settles quickly, no visible bounce on a full-screen surface. */
  screen: { damping: 30, stiffness: 300, mass: 1 },
  /** Notifications: light and slightly overshooting, so they land like a dropped card. */
  notification: { damping: 19, stiffness: 240, mass: 0.85 }
} as const;

/** How far a scene slides during a transition, as a fraction of its own width. */
export const transition = {
  /** Tab scenes shift a short distance in the direction of travel. */
  tabShift: 0.06,
  /** Tab scenes settle up from slightly small, so the glass reads as coming forward. */
  tabScale: 0.965,
  /** The outgoing card in a push parallaxes back by this fraction. */
  cardParallax: 0.28,
  /** How dark the covered card gets under a pushed screen. */
  cardDim: 0.35
} as const;

export { typeScale, typography, fontFamily, type TypeVariant } from "@/theme/typography";
