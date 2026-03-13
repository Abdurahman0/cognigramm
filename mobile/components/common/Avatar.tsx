import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  showOnlineDot?: boolean;
  isOnline?: boolean;
}

export function Avatar({ uri, name, size = 44, showOnlineDot = false, isOnline = false }: AvatarProps): JSX.Element {
  const { theme } = useAppTheme();
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.colors.accentMuted
            }
          ]}
        >
          <Text style={[styles.initials, { color: theme.colors.accent }]}>{initials}</Text>
        </View>
      )}
      {showOnlineDot ? (
        <View
          style={[
            styles.online,
            {
              backgroundColor: isOnline ? theme.colors.online : theme.colors.textMuted,
              borderColor: theme.colors.surface
            }
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center"
  },
  initials: {
    fontSize: 14,
    fontWeight: "700"
  },
  online: {
    borderRadius: 7,
    borderWidth: 2,
    bottom: 1,
    height: 14,
    position: "absolute",
    right: 0,
    width: 14
  }
});
