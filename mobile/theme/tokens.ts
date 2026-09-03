export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
  /** Outer window / floating panel corner. */
  panel: 26,
  pill: 999
} as const;

export const typography = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  bodySm: 13,
  caption: 12,
  label: 11
} as const;

/** Blur strength per surface role, consumed by GlassView on web and native. */
export const blur = {
  soft: 14,
  panel: 24,
  strong: 36
} as const;

export const layout = {
  /** Floating nav rail on desktop. */
  railWidth: 68,
  sidebarWidth: 264,
  listPaneWidth: 372,
  listPaneMinWidth: 312,
  listPaneMaxWidth: 420,
  /** Max readable width for centred detail pages. */
  detailMaxWidth: 880,
  authMaxWidth: 420,
  /** Floating mobile tab bar. */
  tabBarHeight: 62
} as const;

export const duration = {
  fast: 140,
  base: 220,
  slow: 320
} as const;
