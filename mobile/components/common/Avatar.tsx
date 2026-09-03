import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { PresenceDot } from "@/components/ui/PresenceDot";
import { useAppTheme } from "@/hooks/useAppTheme";

export type AvatarShape = "circle" | "squircle";

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  shape?: AvatarShape;
  showOnlineDot?: boolean;
  isOnline?: boolean;
  /** Soft glass ring around the avatar, used on presence rails and call heroes. */
  ring?: boolean;
  ringColor?: string;
  /** Colour behind the presence dot, normally the surface the avatar sits on. */
  presenceRingColor?: string;
}

export function Avatar({
  uri,
  name,
  size = 44,
  shape = "circle",
  showOnlineDot = false,
  isOnline = false,
  ring = false,
  ringColor,
  presenceRingColor
}: AvatarProps): JSX.Element {
  const { theme } = useAppTheme();
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const cornerRadius = shape === "squircle" ? Math.round(size * 0.26) : size / 2;
  const dotSize = Math.max(10, Math.round(size * 0.28));

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: cornerRadius },
        ring && {
          borderWidth: 2,
          borderColor: ringColor ?? theme.colors.glassBorder
        }
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%", borderRadius: cornerRadius }}
          contentFit="cover"
          transition={140}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              borderRadius: cornerRadius,
              backgroundColor: theme.colors.accentMuted
            }
          ]}
        >
          <Text style={[styles.initials, { color: theme.colors.accent, fontSize: Math.max(11, size * 0.34) }]}>
            {initials}
          </Text>
        </View>
      )}
      {showOnlineDot ? (
        <PresenceDot
          online={isOnline}
          size={dotSize}
          ringColor={presenceRingColor}
          style={[styles.presence, { right: -1, bottom: -1 }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%"
  },
  initials: {
    fontWeight: "700"
  },
  presence: {
    position: "absolute"
  }
});
