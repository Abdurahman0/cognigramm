import { Platform, type TextStyle } from "react-native";

/**
 * SF Pro on Apple platforms, the closest system face elsewhere. React Native maps
 * `System` to SF on iOS; web needs the explicit `-apple-system` stack.
 */
export const fontFamily = Platform.select({
  ios: "System",
  android: "sans-serif",
  default:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif'
}) as string;

export type TypeVariant =
  | "largeTitle"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "bodyEmphasized"
  | "callout"
  | "subhead"
  | "subheadEmphasized"
  | "footnote"
  | "caption1"
  | "caption2";

/** The iOS type ramp: size, leading, weight, and optical tracking per role. */
export const typeScale: Record<TypeVariant, TextStyle> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", letterSpacing: -0.41 },
  bodyEmphasized: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400", letterSpacing: -0.24 },
  subheadEmphasized: { fontSize: 15, lineHeight: 20, fontWeight: "600", letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: "500", letterSpacing: 0.06 }
};

/** Legacy numeric sizes kept for call sites that only need a font size. */
export const typography = {
  h1: typeScale.largeTitle.fontSize as number,
  h2: typeScale.title2.fontSize as number,
  h3: typeScale.title3.fontSize as number,
  body: typeScale.body.fontSize as number,
  bodySm: typeScale.subhead.fontSize as number,
  caption: typeScale.caption1.fontSize as number,
  label: typeScale.caption2.fontSize as number
} as const;
