import { forwardRef } from "react";
import type { TextInputProps } from "react-native";
import { Platform, StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  { label, error, hint, style, ...props },
  ref
) {
  const { theme } = useAppTheme();
  const hasError = Boolean(error);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <AppText variant="footnote" tone="secondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.accent}
        {...(Platform.OS === "web" ? { dataSet: { glass: "thin" } } : null)}
        style={[
          styles.input,
          theme.typeScale.body,
          Platform.OS === "web" ? styles.inputWeb : null,
          {
            fontFamily: theme.fontFamily,
            borderColor: hasError ? theme.colors.danger : theme.colors.glassBorder,
            backgroundColor: theme.colors.materialUltraThin,
            color: theme.colors.textPrimary,
            borderRadius: theme.radius.md
          },
          style
        ]}
        {...props}
      />
      {error ? (
        <AppText variant="caption1" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption1" tone="tertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: 6
  },
  label: {
    paddingHorizontal: 4
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  inputWeb: {
    outlineStyle: "solid",
    outlineWidth: 0,
    outlineColor: "transparent"
  }
});
