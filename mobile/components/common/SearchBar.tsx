import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
}

export function SearchBar({
  placeholder = "Search",
  value,
  onChangeText,
  onClear
}: SearchBarProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.root,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md
        }
      ]}
    >
      <Feather name="search" size={17} color={theme.colors.textMuted} />
      <TextInput
        style={[styles.input, { color: theme.colors.textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 ? (
        <Pressable onPress={onClear} hitSlop={10}>
          <Feather name="x" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 12
  },
  input: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    paddingVertical: 10
  }
});
