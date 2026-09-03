import { forwardRef } from "react";
import type { TextInputProps } from "react-native";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

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
        {...(Platform.OS === "web" ? { dataSet: { glass: "soft" } } : null)}
        style={[
          styles.input,
          Platform.OS === "web" ? styles.inputWeb : null,
          {
            borderColor: hasError ? theme.colors.danger : theme.colors.glassBorder,
            backgroundColor: theme.colors.glassSoft,
            color: theme.colors.textPrimary,
            borderRadius: theme.radius.lg
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
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  inputWeb: {
    outlineStyle: "solid",
    outlineWidth: 0,
    outlineColor: "transparent"
  },
  error: {
    fontSize: 12,
    fontWeight: "500"
  },
  hint: {
    fontSize: 12
  }
});
