import { forwardRef } from "react";
import type { TextInputProps } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

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
      {label ? <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            borderColor: hasError ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.surface,
            color: theme.colors.textPrimary,
            borderRadius: theme.radius.md
          },
          style
        ]}
        {...props}
      />
      {error ? (
        <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  error: {
    fontSize: 12,
    fontWeight: "500"
  },
  hint: {
    fontSize: 12
  }
});
