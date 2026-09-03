import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface PresenceDotProps {
  online?: boolean;
  size?: number;
  /** Ring colour, normally the surface the dot sits on. */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function PresenceDot({ online = false, size = 12, ringColor, style }: PresenceDotProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: online ? theme.colors.online : theme.colors.textMuted,
          borderColor: ringColor ?? theme.colors.backdropBase,
          borderWidth: size >= 10 ? 2 : 1.5
        },
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden"
  }
});
