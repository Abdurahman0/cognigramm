import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

import { GlassView } from "@/components/ui/GlassView";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SearchBar({
  placeholder = "Search",
  value,
  onChangeText,
  onClear,
  style
}: SearchBarProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <GlassView tone="soft" radius={theme.radius.pill} bordered={false} style={[styles.root, style]}>
      <Feather name="search" size={17} color={theme.colors.textMuted} />
      <TextInput
        style={[styles.input, Platform.OS === "web" ? styles.inputWeb : null, { color: theme.colors.textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <Feather name="x" size={17} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    fontSize: 15,
    marginLeft: 9,
    paddingVertical: 10
  },
  inputWeb: {
    outlineStyle: "solid",
    outlineWidth: 0,
    outlineColor: "transparent"
  }
});
