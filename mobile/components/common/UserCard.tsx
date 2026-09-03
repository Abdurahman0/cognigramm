import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { User } from "@/types";

interface UserCardProps {
  user: User;
  onPress?: () => void;
  trailingLabel?: string;
}

export function UserCard({ user, onPress, trailingLabel }: UserCardProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed, hovered }) => [
        styles.root,
        {
          borderRadius: theme.radius.lg,
          backgroundColor: hovered ? theme.colors.glassHover : theme.colors.glassSoft,
          opacity: pressed ? 0.9 : 1
        }
      ]}
      onPress={onPress}
    >
      <Avatar
        uri={user.avatar}
        name={user.fullName}
        isOnline={user.isOnline}
        showOnlineDot
        size={44}
      />
      <View style={styles.main}>
        <Text numberOfLines={1} style={[styles.name, { color: theme.colors.textPrimary }]}>
          {user.fullName}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.textMuted }]}>
          {ROLE_LABELS[user.role]} · {user.department}
        </Text>
      </View>
      {trailingLabel ? (
        <Text
          style={[
            styles.trailing,
            { color: user.isOnline ? theme.colors.online : theme.colors.textMuted }
          ]}
        >
          {trailingLabel}
        </Text>
      ) : null}
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 70,
    paddingHorizontal: 14
  },
  main: {
    flex: 1,
    gap: 3
  },
  name: {
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    fontSize: 12
  },
  trailing: {
    fontSize: 12,
    fontWeight: "600"
  }
});
