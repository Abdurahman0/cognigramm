export interface AppColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  success: string;
  warning: string;
  danger: string;
  online: string;
  messageMine: string;
  messageOther: string;
  overlay: string;
  shadow: string;
}

export const lightColors: AppColors = {
  background: "#F2F4F8",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF2F7",
  border: "#D7DFEB",
  textPrimary: "#0F172A",
  textSecondary: "#334155",
  textMuted: "#64748B",
  accent: "#2B59FF",
  accentMuted: "#E1E9FF",
  success: "#0F9D58",
  warning: "#E66A0A",
  danger: "#D73A49",
  online: "#2DBE7C",
  messageMine: "#2B59FF",
  messageOther: "#E8EDF5",
  overlay: "rgba(8, 15, 32, 0.44)",
  shadow: "rgba(15, 23, 42, 0.12)"
};

export const darkColors: AppColors = {
  background: "#070E1C",
  surface: "#0F1A2E",
  surfaceMuted: "#17253D",
  border: "#253854",
  textPrimary: "#E2E8F0",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  accent: "#5A86FF",
  accentMuted: "#1C2C4B",
  success: "#44D388",
  warning: "#FF9D4D",
  danger: "#FF667A",
  online: "#4BDD8D",
  messageMine: "#3D6CFF",
  messageOther: "#1D2A44",
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "rgba(0, 0, 0, 0.35)"
};
