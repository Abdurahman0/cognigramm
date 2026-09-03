import { Text, type TextProps } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import type { TypeVariant } from "@/theme";

export type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "faint"
  | "accent"
  | "onAccent"
  | "danger"
  | "success";

interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Explicit colour wins over `tone`, for text sitting on tinted material. */
  color?: string;
}

/** Text on the iOS type ramp, with label opacity tiers instead of ad-hoc greys. */
export function AppText({
  variant = "body",
  tone = "primary",
  color,
  style,
  ...props
}: AppTextProps): JSX.Element {
  const { theme } = useAppTheme();

  const toneColor =
    tone === "secondary"
      ? theme.colors.textSecondary
      : tone === "tertiary"
      ? theme.colors.textMuted
      : tone === "faint"
      ? theme.colors.textFaint
      : tone === "accent"
      ? theme.colors.accent
      : tone === "onAccent"
      ? theme.colors.onAccent
      : tone === "danger"
      ? theme.colors.danger
      : tone === "success"
      ? theme.colors.success
      : theme.colors.textPrimary;

  return (
    <Text
      {...props}
      style={[
        { fontFamily: theme.fontFamily, color: color ?? toneColor },
        theme.typeScale[variant],
        style
      ]}
    />
  );
}
