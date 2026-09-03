import type { ReactNode } from "react";
import { ActivityIndicator, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAppTheme } from "@/hooks/useAppTheme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "regular" | "small";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
}

/** Capsule button: filled, glass, plain, or destructive — all with a springy press. */
export function AppButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  variant = "primary",
  size = "regular",
  style
}: AppButtonProps): JSX.Element {
  const { theme } = useAppTheme();
  const isDisabled = disabled || loading;
  const isGlass = variant === "secondary";

  const palette =
    variant === "primary"
      ? { background: theme.colors.accent, border: "transparent", text: theme.colors.onAccent }
      : variant === "danger"
      ? { background: theme.colors.danger, border: "transparent", text: theme.colors.onAccent }
      : variant === "secondary"
      ? {
          background: theme.colors.materialUltraThin,
          border: theme.colors.glassBorder,
          text: theme.colors.textPrimary
        }
      : { background: "transparent", border: "transparent", text: theme.colors.accent };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        fullWidth ? styles.fullWidth : styles.auto,
        { opacity: isDisabled ? 0.4 : 1 },
        style
      ]}
    >
      <View
        {...(Platform.OS === "web" && isGlass ? { dataSet: { glass: "thin" } } : null)}
        style={[
          styles.button,
          size === "small" ? styles.small : styles.regular,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
            borderWidth: isGlass ? StyleSheet.hairlineWidth * 2 : 0
          },
          variant === "primary" || variant === "danger" ? theme.elevation.soft : null
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.text} />
        ) : (
          <>
            {icon}
            <AppText variant="bodyEmphasized" color={palette.text} numberOfLines={1}>
              {label}
            </AppText>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: "100%"
  },
  auto: {
    alignSelf: "flex-start"
  },
  button: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    overflow: "hidden"
  },
  regular: {
    minHeight: 50,
    paddingHorizontal: 22
  },
  small: {
    minHeight: 36,
    paddingHorizontal: 16
  }
});
