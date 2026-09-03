import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** iOS search field: capsule of thin glass, muted glyphs, 17pt text. */
export function SearchBar({
  placeholder = "Search",
  value,
  onChangeText,
  onClear,
  style
}: SearchBarProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <View
      {...(Platform.OS === "web" ? { dataSet: { glass: "thin" } } : null)}
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.materialUltraThin,
          borderColor: theme.colors.glassBorder,
          borderRadius: theme.radius.pill
        },
        style
      ]}
    >
      <Feather name="search" size={16} color={theme.colors.textMuted} />
      <TextInput
        style={[
          styles.input,
          theme.typeScale.body,
          Platform.OS === "web" ? styles.inputWeb : null,
          { color: theme.colors.textPrimary, fontFamily: theme.fontFamily }
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.accent}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <Feather name="x-circle" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: "row",
    minHeight: 40,
    overflow: "hidden",
    paddingHorizontal: 13
  },
  input: {
    flex: 1,
    marginLeft: 7,
    paddingVertical: 9
  },
  inputWeb: {
    outlineStyle: "solid",
    outlineWidth: 0,
    outlineColor: "transparent"
  }
});
