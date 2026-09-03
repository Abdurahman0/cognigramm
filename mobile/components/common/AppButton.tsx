import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  variant = "primary",
  style
}: AppButtonProps): JSX.Element {
  const { theme } = useAppTheme();
  const isDisabled = disabled || loading;

  const variantStyle =
    variant === "primary"
      ? {
          backgroundColor: theme.colors.accent,
          borderColor: theme.colors.accent,
          textColor: theme.colors.onAccent
        }
      : variant === "secondary"
      ? {
          backgroundColor: theme.colors.glassSoft,
          borderColor: theme.colors.glassBorder,
          textColor: theme.colors.textPrimary
        }
      : variant === "danger"
      ? {
          backgroundColor: theme.colors.danger,
          borderColor: theme.colors.danger,
          textColor: theme.colors.onAccent
        }
      : {
          backgroundColor: "transparent",
          borderColor: "transparent",
          textColor: theme.colors.accent
        };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed, hovered }) => [
        styles.button,
        {
          width: fullWidth ? "100%" : "auto",
          borderRadius: theme.radius.pill,
          borderColor: variantStyle.borderColor,
          backgroundColor: variantStyle.backgroundColor,
          opacity: isDisabled ? 0.5 : pressed ? 0.86 : hovered ? 0.93 : 1
        },
        variant === "primary" || variant === "danger" ? theme.elevation.soft : null,
        style
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={variantStyle.textColor} />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, { color: variantStyle.textColor }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18
  },
  inner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center"
  },
  label: {
    fontSize: 15,
    fontWeight: "700"
  }
});
