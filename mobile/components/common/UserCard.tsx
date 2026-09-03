import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { AppText } from "@/components/ui/AppText";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { User } from "@/types";

interface UserCardProps {
  user: User;
  onPress?: () => void;
  trailingLabel?: string;
  /** Rows normally sit inside a grouped ListSection, which draws the card. */
  standalone?: boolean;
}

export function UserCard({ user, onPress, trailingLabel, standalone = false }: UserCardProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed, hovered }) => [
        styles.root,
        standalone && {
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.materialUltraThin
        },
        {
          backgroundColor: pressed
            ? theme.colors.fillSecondary
            : hovered
            ? theme.colors.fillTertiary
            : standalone
            ? theme.colors.materialUltraThin
            : "transparent"
        }
      ]}
      onPress={onPress}
    >
      <Avatar uri={user.avatar} name={user.fullName} isOnline={user.isOnline} showOnlineDot size={44} />
      <View style={styles.main}>
        <AppText variant="body" numberOfLines={1}>
          {user.fullName}
        </AppText>
        <AppText variant="footnote" tone="secondary" numberOfLines={1}>
          {ROLE_LABELS[user.role]} · {user.department}
        </AppText>
      </View>
      {trailingLabel ? (
        <AppText variant="footnote" tone={user.isOnline ? "success" : "tertiary"}>
          {trailingLabel}
        </AppText>
      ) : null}
      <Feather name="chevron-right" size={17} color={theme.colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  main: {
    flex: 1,
    gap: 1
  }
});
